#include "../include/analytics_manager.h"
#include "../include/posts_analytics.h"
#include "../include/action.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <random>

int main() {
    AnalyticsManager manager("./analytics_data", 100, std::chrono::milliseconds(5000));
    manager.start();

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> post_dist(18, 50);
    std::uniform_int_distribution<> user_dist(1, 50);
    std::uniform_int_distribution<> action_dist(0, 5);

    Action actions[] = {
        Action::PLAY,
        Action::PAUSE,
        Action::UNMUTE,
        Action::CAROUSEL_LEFT,
        Action::CAROUSEL_RIGHT,
        Action::VIEW
    };

    std::cout << "[log] starting first batch: 500 events" << std::endl;
    for (int i = 0; i < 500; ++i) {
        std::string post_id = "post_" + std::to_string(post_dist(gen));
        std::string user_id = "user_" + std::to_string(user_dist(gen));
        Action action = actions[action_dist(gen)];
        auto now = std::chrono::system_clock::now();

        PostsAnalytics event(post_id, user_id, action, now);
        manager.ingest_event(event);

        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    std::cout << "[log] first batch of 500 events completed" << std::endl;

    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    auto state = manager.get_current_state();
    if (state) {
        std::cout << "[log] analytics after first batch:" << std::endl;
        std::cout << "[log] total events: " << state->total_events() << std::endl;
        std::cout << "[log] total visitors: " << state->total_visitors() << std::endl;
        if (!state->hot_posts().empty()) {
            std::cout << "[log] hot post: " << state->hot_posts()[0] << std::endl;
        }
        if (!state->most_played().empty()) {
            std::cout << "[log] most played: " << state->most_played()[0] << std::endl;
        }
    }

    std::cout << "[log] starting second batch: 5000 events" << std::endl;
    for (int i = 0; i < 5000; ++i) {
        std::string post_id = "post_" + std::to_string(post_dist(gen));
        std::string user_id = "user_" + std::to_string(user_dist(gen));
        Action action = actions[action_dist(gen)];
        auto now = std::chrono::system_clock::now();

        PostsAnalytics event(post_id, user_id, action, now);
        manager.ingest_event(event);

        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    std::cout << "[log] second batch of 5000 events completed" << std::endl;

    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    state = manager.get_current_state();
    if (state) {
        std::cout << "[log] analytics after second batch:" << std::endl;
        std::cout << "[log] total events: " << state->total_events() << std::endl;
        std::cout << "[log] total visitors: " << state->total_visitors() << std::endl;
        if (!state->hot_posts().empty()) {
            std::cout << "[log] hot post: " << state->hot_posts()[0] << std::endl;
        }
        if (!state->most_played().empty()) {
            std::cout << "[log] most played: " << state->most_played()[0] << std::endl;
        }
    }

    manager.stop();
    return 0;
}
