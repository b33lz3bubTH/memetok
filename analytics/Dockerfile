FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY CMakeLists.txt ./
COPY include/ ./include/
COPY src/ ./src/

RUN mkdir -p build && cd build && \
    cmake .. && \
    make -j$(nproc)

WORKDIR /app/build

CMD ["./analytics_sidecar"]
