#pragma once

#include "analytics_manager.h"
#include "posts_analytics.h"
#include "action.h"
#include <zmq.h>
#include <string>
#include <thread>
#include <atomic>
#include <iostream>
#include <nlohmann/json.hpp>

class ZmqServer {
public:
    ZmqServer(AnalyticsManager& manager, const std::string& endpoint = "tcp://*:5555")
        : manager_(manager), endpoint_(endpoint), running_(false), ctx_(nullptr), socket_(nullptr) {}

    ~ZmqServer() {
        stop();
    }

    void start() {
        running_ = true;
        server_thread_ = std::thread(&ZmqServer::run, this);
        log("zmq server started on " + endpoint_);
    }

    void stop() {
        running_ = false;
        if (server_thread_.joinable()) {
            server_thread_.join();
        }
        log("zmq server stopped");
    }

private:
    void run() {
        ctx_ = zmq_ctx_new();
        socket_ = zmq_socket(ctx_, ZMQ_PULL);
        
        int rc = zmq_bind(socket_, endpoint_.c_str());
        if (rc != 0) {
            log("failed to bind zmq socket: " + std::string(zmq_strerror(errno)));
            return;
        }

        int timeout = 100;
        zmq_setsockopt(socket_, ZMQ_RCVTIMEO, &timeout, sizeof(timeout));

        char buffer[4096];
        while (running_) {
            int size = zmq_recv(socket_, buffer, sizeof(buffer) - 1, 0);
            if (size > 0) {
                buffer[size] = '\0';
                process_message(std::string(buffer));
            }
        }

        zmq_close(socket_);
        zmq_ctx_destroy(ctx_);
    }

    void process_message(const std::string& msg) {
        try {
            auto j = nlohmann::json::parse(msg);
            
            std::string post_id = j.value("post_id", "");
            std::string user_id = j.value("user_id", "");
            std::string action_str = j.value("action", "view");
            
            if (post_id.empty() || user_id.empty()) {
                return;
            }

            Action action = string_to_action(action_str);
            auto now = std::chrono::system_clock::now();
            
            if (j.contains("created_at")) {
                auto ts = j["created_at"].get<int64_t>();
                now = std::chrono::system_clock::time_point(std::chrono::milliseconds(ts));
            }

            PostsAnalytics event(post_id, user_id, action, now);
            manager_.ingest_event(event);
        } catch (const std::exception& e) {
            log("error parsing message: " + std::string(e.what()));
        }
    }

    void log(const std::string& message) const {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()) % 1000;
        
        std::cout << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S")
                  << "." << std::setfill('0') << std::setw(3) << ms.count()
                  << " [zmq] " << message << std::endl;
    }

    AnalyticsManager& manager_;
    std::string endpoint_;
    std::atomic<bool> running_;
    void* ctx_;
    void* socket_;
    std::thread server_thread_;
};
