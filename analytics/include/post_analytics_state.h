#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <unordered_map>
#include <cstdint>
#include <algorithm>

constexpr size_t MAX_HOT_POSTS = 10;

struct PostStats {
    uint64_t views = 0;
    uint64_t plays = 0;
    uint64_t pauses = 0;
    uint64_t unmutes = 0;
    uint64_t carousel_left = 0;
    uint64_t carousel_right = 0;
    int64_t score = 0;
};

class PostAnalyticsState {
public:
    PostAnalyticsState() : start_time_(std::chrono::system_clock::now()) {}

    std::chrono::system_clock::time_point start_time() const { return start_time_; }
    const std::vector<std::string>& hot_posts() const { return hot_posts_; }
    const std::vector<std::string>& most_played() const { return most_played_; }
    const std::unordered_map<std::string, PostStats>& post_stats() const { return post_stats_; }
    uint64_t total_visitors() const { return total_visitors_; }
    uint64_t total_events() const { return total_events_; }

    void set_start_time(std::chrono::system_clock::time_point time) { start_time_ = time; }
    void set_hot_posts(const std::vector<std::string>& posts) { hot_posts_ = posts; }
    void set_most_played(const std::vector<std::string>& posts) { most_played_ = posts; }
    PostStats& get_or_create_post_stats(const std::string& post_id) {
        return post_stats_[post_id];
    }
    void increment_total_visitors() { total_visitors_++; }
    void increment_total_events() { total_events_++; }
    
    void set_post_stats(const std::unordered_map<std::string, PostStats>& stats) {
        post_stats_ = stats;
    }
    
    void trim_to_hot_posts_only() {
        if (hot_posts_.empty()) return;
        
        std::unordered_map<std::string, PostStats> trimmed;
        for (const auto& post_id : hot_posts_) {
            auto it = post_stats_.find(post_id);
            if (it != post_stats_.end()) {
                trimmed[post_id] = it->second;
            }
        }
        post_stats_ = trimmed;
    }

private:
    std::chrono::system_clock::time_point start_time_;
    std::vector<std::string> hot_posts_;
    std::vector<std::string> most_played_;
    std::unordered_map<std::string, PostStats> post_stats_;
    uint64_t total_visitors_ = 0;
    uint64_t total_events_ = 0;
};
