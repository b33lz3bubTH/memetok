#pragma once

#include <string>
#include <unordered_map>

enum class Action {
    PLAY,
    PAUSE,
    UNMUTE,
    CAROUSEL_LEFT,
    CAROUSEL_RIGHT,
    VIEW
};

inline const std::unordered_map<Action, int> POSTS_WEIGHTAGE = {
    {Action::VIEW, 1},
    {Action::PLAY, 2},
    {Action::UNMUTE, 1},
    {Action::PAUSE, -1},
    {Action::CAROUSEL_LEFT, 0},
    {Action::CAROUSEL_RIGHT, 0}
};

inline Action string_to_action(const std::string& str) {
    if (str == "play") return Action::PLAY;
    if (str == "pause") return Action::PAUSE;
    if (str == "unmute") return Action::UNMUTE;
    if (str == "carousel_left") return Action::CAROUSEL_LEFT;
    if (str == "carousel_right") return Action::CAROUSEL_RIGHT;
    if (str == "view") return Action::VIEW;
    return Action::VIEW;
}

inline std::string action_to_string(Action action) {
    switch (action) {
        case Action::PLAY: return "play";
        case Action::PAUSE: return "pause";
        case Action::UNMUTE: return "unmute";
        case Action::CAROUSEL_LEFT: return "carousel_left";
        case Action::CAROUSEL_RIGHT: return "carousel_right";
        case Action::VIEW: return "view";
        default: return "view";
    }
}
