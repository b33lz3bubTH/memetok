.PHONY: build clean test docker-build docker-run docker-test bin

BUILD_DIR = build
BIN_DIR = bin
BINARY = analytics_sidecar

build:
	mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR) && cmake .. && make -j$(shell nproc)

bin: build
	mkdir -p $(BIN_DIR)
	cp $(BUILD_DIR)/$(BINARY) $(BIN_DIR)/

clean:
	rm -rf $(BUILD_DIR) $(BIN_DIR)

test: bin
	./$(BIN_DIR)/$(BINARY)

docker-build:
	docker build -t analytics-sidecar:latest .

docker-run: docker-build
	docker run --rm analytics-sidecar:latest

docker-test: docker-build
	docker run --rm -v $(PWD)/analytics_data:/app/build/analytics_data analytics-sidecar:latest
