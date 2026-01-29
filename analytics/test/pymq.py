import zmq
import json
import random
import time
import argparse
from datetime import datetime

ACTIONS = ["play", "pause", "unmute", "carousel_left", "carousel_right", "view"]

def generate_event(post_range=(1, 50), user_range=(1, 100)):
    return {
        "post_id": f"post_{random.randint(*post_range)}",
        "user_id": f"user_{random.randint(*user_range)}",
        "action": random.choice(ACTIONS),
        "created_at": int(time.time() * 1000)
    }

def main():
    parser = argparse.ArgumentParser(description="Send random analytics events via ZeroMQ")
    parser.add_argument("--host", default="localhost", help="Analytics server host")
    parser.add_argument("--port", type=int, default=5555, help="Analytics server port")
    parser.add_argument("--events", type=int, default=1000, help="Number of events to send")
    parser.add_argument("--delay", type=float, default=0.01, help="Delay between events (seconds)")
    parser.add_argument("--batch", type=int, default=100, help="Log progress every N events")
    parser.add_argument("--post-min", type=int, default=1, help="Min post ID")
    parser.add_argument("--post-max", type=int, default=50, help="Max post ID")
    parser.add_argument("--user-min", type=int, default=1, help="Min user ID")
    parser.add_argument("--user-max", type=int, default=100, help="Max user ID")
    args = parser.parse_args()

    endpoint = f"tcp://{args.host}:{args.port}"
    
    context = zmq.Context()
    socket = context.socket(zmq.PUSH)
    socket.connect(endpoint)
    
    print(f"[pymq] connected to {endpoint}")
    print(f"[pymq] sending {args.events} events...")
    print(f"[pymq] post range: {args.post_min}-{args.post_max}, user range: {args.user_min}-{args.user_max}")
    
    start_time = time.time()
    
    for i in range(args.events):
        event = generate_event(
            post_range=(args.post_min, args.post_max),
            user_range=(args.user_min, args.user_max)
        )
        socket.send_string(json.dumps(event))
        
        if (i + 1) % args.batch == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            print(f"[pymq] sent {i + 1}/{args.events} events ({rate:.1f} events/sec)")
        
        if args.delay > 0:
            time.sleep(args.delay)
    
    elapsed = time.time() - start_time
    rate = args.events / elapsed
    
    print(f"[pymq] done! sent {args.events} events in {elapsed:.2f}s ({rate:.1f} events/sec)")
    
    socket.close()
    context.term()

if __name__ == "__main__":
    main()
