#pragma once

#include "action.h"
#include <string>
#include <chrono>

class PostsAnalytics {
public:
    PostsAnalytics(
        const std::string& post_id,
        const std::string& user_id,
        Action action,
        std::chrono::system_clock::time_point created_at
    ) : post_id_(post_id),
        user_id_(user_id),
        action_(action),
        created_at_(created_at) {}

    int get_score() const {
        auto it = POSTS_WEIGHTAGE.find(action_);
        return (it != POSTS_WEIGHTAGE.end()) ? it->second : 0;
    }

    const std::string& post_id() const { return post_id_; }
    const std::string& user_id() const { return user_id_; }
    Action action() const { return action_; }
    std::chrono::system_clock::time_point created_at() const { return created_at_; }

private:
    std::string post_id_;
    std::string user_id_;
    Action action_;
    std::chrono::system_clock::time_point created_at_;
};
