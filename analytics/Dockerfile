FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    libzmq3-dev \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pyzmq

WORKDIR /app

COPY CMakeLists.txt ./
COPY include/ ./include/
COPY src/ ./src/
COPY test/ ./test/

RUN mkdir -p build && cd build && \
    cmake .. && \
    make -j$(nproc)

WORKDIR /app/build

CMD ["./analytics_sidecar"]
