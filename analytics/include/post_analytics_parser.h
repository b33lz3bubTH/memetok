#pragma once

#include "posts_analytics.h"
#include "post_analytics_state.h"
#include <vector>
#include <memory>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>

class PostAnalyticsParser {
public:
    PostAnalyticsParser(
        const std::vector<PostsAnalytics>& posts,
        std::shared_ptr<PostAnalyticsState> prev_state
    ) : posts_(posts), prev_state_(prev_state) {
        if (!prev_state_) {
            prev_state_ = std::make_shared<PostAnalyticsState>();
        }
        current_state_ = std::make_shared<PostAnalyticsState>(*prev_state_);
    }

    void calc_current_hot_post() {
        std::unordered_map<std::string, int64_t> batch_scores;
        for (const auto& post : posts_) {
            batch_scores[post.post_id()] += post.get_score();
        }
        
        std::unordered_map<std::string, int64_t> all_scores;
        
        for (const auto& [post_id, stats] : current_state_->post_stats()) {
            all_scores[post_id] = stats.score;
        }
        
        for (const auto& [post_id, score] : batch_scores) {
            all_scores[post_id] += score;
        }

        std::vector<std::pair<std::string, int64_t>> sorted_posts;
        for (const auto& [post_id, score] : all_scores) {
            sorted_posts.emplace_back(post_id, score);
        }

        std::sort(sorted_posts.begin(), sorted_posts.end(),
            [](const auto& a, const auto& b) {
                return a.second > b.second;
            });

        std::unordered_set<std::string> prev_hot_set;
        for (const auto& post_id : prev_state_->hot_posts()) {
            prev_hot_set.insert(post_id);
        }

        std::vector<std::string> hot_posts;
        std::unordered_map<std::string, PostStats> hot_post_stats;
        
        for (const auto& [post_id, score] : sorted_posts) {
            if (hot_posts.size() >= MAX_HOT_POSTS) break;
            
            hot_posts.push_back(post_id);
            
            auto it = current_state_->post_stats().find(post_id);
            if (it != current_state_->post_stats().end()) {
                hot_post_stats[post_id] = it->second;
            } else {
                PostStats stats;
                stats.score = score;
                hot_post_stats[post_id] = stats;
            }
        }
        
        for (const auto& post_id : prev_state_->hot_posts()) {
            if (hot_posts.size() >= MAX_HOT_POSTS) break;
            
            bool already_in = false;
            for (const auto& hp : hot_posts) {
                if (hp == post_id) {
                    already_in = true;
                    break;
                }
            }
            
            if (!already_in) {
                auto it = prev_state_->post_stats().find(post_id);
                if (it != prev_state_->post_stats().end()) {
                    int64_t lowest_score = INT64_MAX;
                    size_t lowest_idx = 0;
                    
                    for (size_t i = 0; i < hot_posts.size(); i++) {
                        auto hit = hot_post_stats.find(hot_posts[i]);
                        if (hit != hot_post_stats.end() && hit->second.score < lowest_score) {
                            lowest_score = hit->second.score;
                            lowest_idx = i;
                        }
                    }
                    
                    if (it->second.score > lowest_score && hot_posts.size() == MAX_HOT_POSTS) {
                        hot_post_stats.erase(hot_posts[lowest_idx]);
                        hot_posts[lowest_idx] = post_id;
                        hot_post_stats[post_id] = it->second;
                    }
                }
            }
        }
        
        current_state_->set_hot_posts(hot_posts);
        current_state_->set_post_stats(hot_post_stats);
    }

    void tally_with_prev() {
        std::unordered_map<std::string, bool> seen_users;
        
        for (const auto& post : posts_) {
            current_state_->increment_total_events();
            
            if (seen_users.find(post.user_id()) == seen_users.end()) {
                seen_users[post.user_id()] = true;
                current_state_->increment_total_visitors();
            }

            auto& stats = current_state_->get_or_create_post_stats(post.post_id());
            
            switch (post.action()) {
                case Action::VIEW:
                    stats.views++;
                    break;
                case Action::PLAY:
                    stats.plays++;
                    break;
                case Action::PAUSE:
                    stats.pauses++;
                    break;
                case Action::UNMUTE:
                    stats.unmutes++;
                    break;
                case Action::CAROUSEL_LEFT:
                    stats.carousel_left++;
                    break;
                case Action::CAROUSEL_RIGHT:
                    stats.carousel_right++;
                    break;
            }

            stats.score += post.get_score();
        }

        std::vector<std::pair<std::string, uint64_t>> played_posts;
        for (const auto& [post_id, stats] : current_state_->post_stats()) {
            played_posts.emplace_back(post_id, stats.plays);
        }

        std::sort(played_posts.begin(), played_posts.end(),
            [](const auto& a, const auto& b) {
                return a.second > b.second;
            });

        std::vector<std::string> most_played;
        size_t count = 0;
        for (const auto& [post_id, _] : played_posts) {
            if (count >= MAX_HOT_POSTS) break;
            most_played.push_back(post_id);
            count++;
        }
        current_state_->set_most_played(most_played);
    }

    void save_current_state() {
        prev_state_ = std::make_shared<PostAnalyticsState>(*current_state_);
    }

    std::string summarize() const {
        std::string summary = "Analytics Summary:\n";
        summary += "Total Events: " + std::to_string(current_state_->total_events()) + "\n";
        summary += "Total Visitors: " + std::to_string(current_state_->total_visitors()) + "\n";
        
        if (!current_state_->hot_posts().empty()) {
            summary += "Hot Post: " + current_state_->hot_posts()[0] + "\n";
        }
        
        return summary;
    }

    std::shared_ptr<PostAnalyticsState> current_state() const { return current_state_; }

private:
    std::vector<PostsAnalytics> posts_;
    std::shared_ptr<PostAnalyticsState> prev_state_;
    std::shared_ptr<PostAnalyticsState> current_state_;
};
