#include "../include/analytics_manager.h"
#include "../include/zmq_server.h"
#include <iostream>
#include <csignal>
#include <atomic>

std::atomic<bool> g_running(true);

void signal_handler(int) {
    g_running = false;
}

int main() {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    AnalyticsManager manager("./analytics_data", 100, std::chrono::milliseconds(5000));
    manager.start();

    ZmqServer zmq_server(manager, "tcp://*:5555");
    zmq_server.start();

    std::cout << "[main] analytics engine running. waiting for events on tcp://0.0.0.0:5555" << std::endl;
    std::cout << "[main] press ctrl+c to stop" << std::endl;

    while (g_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "\n[main] shutting down..." << std::endl;
    zmq_server.stop();
    manager.stop();

    return 0;
}
