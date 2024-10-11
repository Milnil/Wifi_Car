import socket
import time
import random  # Simulate data generation for this example

HOST = "192.168.10.59"  # IP address of your Raspberry Pi
PORT = 65432            # Port to listen on (non-privileged ports are > 1023)

def get_car_status():
    # Simulate getting the car's direction, temperature, and distance
    direction = random.choice(["Forward", "Reverse", "Left", "Right", "Stationary"])
    temperature = round(random.uniform(20.0, 80.0), 2)  # Simulate temperature in Celsius
    distance = round(random.uniform(0.0, 100.0), 2)     # Simulate distance in cm
    return f"Direction: {direction}, Temperature: {temperature}C, Distance: {distance}cm"

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen()

    print(f"Server listening on {HOST}:{PORT}")

    try:
        while True:
            client, clientInfo = s.accept()
            with client:
                print("Connected by", clientInfo)
                while True:
                    # Receive data from the client
                    data = client.recv(1024)
                    if not data:
                        break
                    print("Received data:", data.decode())  # Print the received data

                    # Periodically send car status back to the client
                    for _ in range(10):  # Send 10 updates for each received command
                        car_status = get_car_status()
                        client.sendall(car_status.encode())
                        time.sleep(1)  # Delay between updates (1 second)
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        print("Closing server socket")
        s.close()
