cmake_minimum_required(VERSION 3.20)
project(AnalyticsSidecar VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -O2")

include_directories(${CMAKE_SOURCE_DIR}/include)

find_package(nlohmann_json QUIET)
if(NOT nlohmann_json_FOUND)
    include(FetchContent)
    FetchContent_Declare(
        json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG v3.11.2
    )
    FetchContent_MakeAvailable(json)
endif()

find_package(PkgConfig REQUIRED)
pkg_check_modules(ZMQ REQUIRED libzmq)

add_executable(analytics_sidecar
    src/main.cpp
)

target_include_directories(analytics_sidecar PRIVATE ${ZMQ_INCLUDE_DIRS})

target_link_libraries(analytics_sidecar
    PRIVATE
    nlohmann_json::nlohmann_json
    ${ZMQ_LIBRARIES}
)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(analytics_sidecar PRIVATE DEBUG=1)
endif()
