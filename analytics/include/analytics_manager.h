#pragma once

#include "posts_analytics.h"
#include "post_analytics_state.h"
#include "post_analytics_parser.h"
#include "action.h"
#include <string>
#include <vector>
#include <memory>
#include <fstream>
#include <filesystem>
#include <mutex>
#include <atomic>
#include <thread>
#include <chrono>
#include <queue>
#include <condition_variable>
#include <nlohmann/json.hpp>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cctype>
#include <sys/resource.h>

class AnalyticsManager {
public:
    AnalyticsManager(
        const std::string& data_dir = "./analytics_data",
        size_t flush_event_count = 1000,
        std::chrono::milliseconds flush_interval = std::chrono::milliseconds(30000)
    ) : data_dir_(data_dir),
        flush_event_count_(flush_event_count),
        flush_interval_(flush_interval),
        event_count_(0),
        running_(false) {
        std::filesystem::create_directories(data_dir_);
        wal_file_ = data_dir_ + "/wal.log";
        state_file_ = data_dir_ + "/state.json";
        load_prev_state();
    }

    ~AnalyticsManager() {
        stop();
    }

    void start() {
        running_ = true;
        flush_thread_ = std::thread(&AnalyticsManager::flush_worker, this);
        log("analytics manager started");
    }

    void stop() {
        log("stopping analytics manager");
        running_ = false;
        cv_.notify_all();
        if (flush_thread_.joinable()) {
            flush_thread_.join();
        }
        flush_current_batch();
        log("analytics manager stopped");
    }

    void ingest_event(const PostsAnalytics& event) {
        std::lock_guard<std::mutex> lock(queue_mutex_);
        event_queue_.push(event);
        write_to_wal(event);
        event_count_++;
        
        if (event_count_ % 100 == 0) {
            log("ingested " + std::to_string(event_count_) + " events");
        }
        
        if (event_count_ >= flush_event_count_) {
            cv_.notify_one();
        }
    }

    std::shared_ptr<PostAnalyticsState> get_current_state() const {
        std::lock_guard<std::mutex> lock(state_mutex_);
        return current_state_;
    }

private:
    void write_to_wal(const PostsAnalytics& event) {
        std::ofstream wal(wal_file_, std::ios::app);
        if (wal.is_open()) {
            nlohmann::json j;
            j["post_id"] = event.post_id();
            j["user_id"] = event.user_id();
            j["action"] = action_to_string(event.action());
            j["created_at"] = std::chrono::duration_cast<std::chrono::milliseconds>(
                event.created_at().time_since_epoch()).count();
            wal << j.dump() << "\n";
        }
    }

    void flush_worker() {
        auto last_flush = std::chrono::steady_clock::now();
        
        while (running_) {
            std::unique_lock<std::mutex> lock(queue_mutex_);
            bool should_flush = false;
            
            if (event_count_ >= flush_event_count_) {
                should_flush = true;
            } else {
                auto now = std::chrono::steady_clock::now();
                if (now - last_flush >= flush_interval_) {
                    should_flush = true;
                }
            }

            if (should_flush && !event_queue_.empty()) {
                std::vector<PostsAnalytics> batch;
                while (!event_queue_.empty() && batch.size() < flush_event_count_) {
                    batch.push_back(event_queue_.front());
                    event_queue_.pop();
                }
                lock.unlock();
                
                flush_batch(batch);
                event_count_ = 0;
                last_flush = std::chrono::steady_clock::now();
            } else {
                cv_.wait_for(lock, flush_interval_);
            }
        }
    }

    void flush_batch(const std::vector<PostsAnalytics>& batch) {
        if (batch.empty()) return;

        std::lock_guard<std::mutex> lock(state_mutex_);
        
        log("flushing batch of " + std::to_string(batch.size()) + " events");
        
        auto prev_state_copy = current_state_ ? 
            std::make_shared<PostAnalyticsState>(*current_state_) : 
            std::make_shared<PostAnalyticsState>();
        
        std::string prev_hot_posts = "none";
        if (!prev_state_copy->hot_posts().empty()) {
            prev_hot_posts = prev_state_copy->hot_posts()[0];
            if (prev_state_copy->hot_posts().size() > 1) {
                prev_hot_posts += " (and " + std::to_string(prev_state_copy->hot_posts().size() - 1) + " more)";
            }
        }
        
        log("prev state - events: " + std::to_string(prev_state_copy->total_events()) + 
            ", visitors: " + std::to_string(prev_state_copy->total_visitors()) + 
            ", hot post: " + prev_hot_posts);
        
        PostAnalyticsParser parser(batch, current_state_);
        parser.tally_with_prev();
        parser.calc_current_hot_post();
        
        current_state_ = parser.current_state();
        save_state_to_file();
        parser.save_current_state();
        
        std::string current_hot_posts = "none";
        if (!current_state_->hot_posts().empty()) {
            current_hot_posts = current_state_->hot_posts()[0];
            if (current_state_->hot_posts().size() > 1) {
                current_hot_posts += " (and " + std::to_string(current_state_->hot_posts().size() - 1) + " more)";
            }
        }
        
        log("current state - events: " + std::to_string(current_state_->total_events()) + 
            ", visitors: " + std::to_string(current_state_->total_visitors()) + 
            ", hot post: " + current_hot_posts);
        
        log("batch flushed. total events: " + std::to_string(current_state_->total_events()) + 
            ", total visitors: " + std::to_string(current_state_->total_visitors()) +
            ", mem: " + get_memory_usage() +
            ", hot posts in state: " + std::to_string(current_state_->hot_posts().size()) +
            ", post_stats entries: " + std::to_string(current_state_->post_stats().size()));
    }

    void flush_current_batch() {
        std::unique_lock<std::mutex> lock(queue_mutex_);
        if (event_queue_.empty()) return;

        std::vector<PostsAnalytics> batch;
        while (!event_queue_.empty()) {
            batch.push_back(event_queue_.front());
            event_queue_.pop();
        }
        lock.unlock();

        flush_batch(batch);
    }

    void save_state_to_file() {
        nlohmann::json j;
        j["start_time"] = std::chrono::duration_cast<std::chrono::milliseconds>(
            current_state_->start_time().time_since_epoch()).count();
        j["total_events"] = current_state_->total_events();
        j["total_visitors"] = current_state_->total_visitors();
        
        const auto& hot_posts = current_state_->hot_posts();
        std::vector<std::string> top_hot_posts;
        for (size_t i = 0; i < std::min(hot_posts.size(), MAX_HOT_POSTS); i++) {
            top_hot_posts.push_back(hot_posts[i]);
        }
        j["hot_posts"] = top_hot_posts;
        
        const auto& most_played = current_state_->most_played();
        std::vector<std::string> top_most_played;
        for (size_t i = 0; i < std::min(most_played.size(), MAX_HOT_POSTS); i++) {
            top_most_played.push_back(most_played[i]);
        }
        j["most_played"] = top_most_played;
        
        j["post_stats"] = nlohmann::json::object();
        for (const auto& post_id : top_hot_posts) {
            auto it = current_state_->post_stats().find(post_id);
            if (it != current_state_->post_stats().end()) {
                const auto& stats = it->second;
                nlohmann::json stats_json;
                stats_json["views"] = stats.views;
                stats_json["plays"] = stats.plays;
                stats_json["pauses"] = stats.pauses;
                stats_json["unmutes"] = stats.unmutes;
                stats_json["carousel_left"] = stats.carousel_left;
                stats_json["carousel_right"] = stats.carousel_right;
                stats_json["score"] = stats.score;
                j["post_stats"][post_id] = stats_json;
            }
        }

        std::ofstream file(state_file_);
        if (file.is_open()) {
            file << j.dump(2);
        }
    }
    
    std::string get_memory_usage() const {
        struct rusage usage;
        if (getrusage(RUSAGE_SELF, &usage) == 0) {
            double mem_mb = static_cast<double>(usage.ru_maxrss) / 1024.0;
            std::stringstream ss;
            ss << std::fixed << std::setprecision(2) << mem_mb << " MB";
            return ss.str();
        }
        return "unknown";
    }

    std::string to_lower(const std::string& str) const {
        std::string result = str;
        std::transform(result.begin(), result.end(), result.begin(),
            [](unsigned char c) { return std::tolower(c); });
        return result;
    }

    void log(const std::string& message) const {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()) % 1000;
        
        std::stringstream ss;
        ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
        ss << "." << std::setfill('0') << std::setw(3) << ms.count();
        ss << " [log] " << to_lower(message);
        
        std::cout << ss.str() << std::endl;
    }

    void load_prev_state() {
        if (!std::filesystem::exists(state_file_)) {
            current_state_ = std::make_shared<PostAnalyticsState>();
            log("no previous state found, starting fresh");
            return;
        }
        
        log("loading previous state from " + state_file_);

        std::ifstream file(state_file_);
        if (!file.is_open()) {
            current_state_ = std::make_shared<PostAnalyticsState>();
            return;
        }

        try {
            nlohmann::json j;
            file >> j;
            
            current_state_ = std::make_shared<PostAnalyticsState>();
            
            if (j.contains("start_time")) {
                auto time_point = std::chrono::system_clock::time_point(
                    std::chrono::milliseconds(j["start_time"]));
                current_state_->set_start_time(time_point);
            }
            
            if (j.contains("total_events")) {
                for (size_t i = 0; i < j["total_events"]; i++) {
                    current_state_->increment_total_events();
                }
            }
            
            if (j.contains("total_visitors")) {
                for (size_t i = 0; i < j["total_visitors"]; i++) {
                    current_state_->increment_total_visitors();
                }
            }
            
            if (j.contains("hot_posts")) {
                std::vector<std::string> hot_posts = j["hot_posts"];
                current_state_->set_hot_posts(hot_posts);
            }
            
            if (j.contains("most_played")) {
                std::vector<std::string> most_played = j["most_played"];
                current_state_->set_most_played(most_played);
            }
            
            if (j.contains("post_stats")) {
                for (const auto& [post_id, stats_json] : j["post_stats"].items()) {
                    PostStats stats;
                    stats.views = stats_json.value("views", 0);
                    stats.plays = stats_json.value("plays", 0);
                    stats.pauses = stats_json.value("pauses", 0);
                    stats.unmutes = stats_json.value("unmutes", 0);
                    stats.carousel_left = stats_json.value("carousel_left", 0);
                    stats.carousel_right = stats_json.value("carousel_right", 0);
                    stats.score = stats_json.value("score", 0);
                    current_state_->get_or_create_post_stats(post_id) = stats;
                }
            }
            log("previous state loaded successfully");
        } catch (...) {
            current_state_ = std::make_shared<PostAnalyticsState>();
            log("error loading previous state, starting fresh");
        }
    }

    std::string data_dir_;
    std::string wal_file_;
    std::string state_file_;
    size_t flush_event_count_;
    std::chrono::milliseconds flush_interval_;
    
    std::queue<PostsAnalytics> event_queue_;
    std::mutex queue_mutex_;
    std::condition_variable cv_;
    std::atomic<size_t> event_count_;
    
    std::shared_ptr<PostAnalyticsState> current_state_;
    mutable std::mutex state_mutex_;
    
    std::thread flush_thread_;
    std::atomic<bool> running_;
};
