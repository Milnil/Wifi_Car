import time
import socket
from Motor import *
import RPi.GPIO as GPIO
from PCA9685 import PCA9685
from Led import Led  # Import the Led class
import random  # To simulate the temperature data
from gpiozero import CPUTemperature

import select
import queue


class CombinedCar:
    def __init__(self, host="192.168.10.59", port=65432):
        # Initialize GPIO
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        # Initialize ultrasonic sensor pins
        self.trigger_pin = 27
        self.echo_pin = 22
        self.MAX_DISTANCE = 300
        self.timeOut = self.MAX_DISTANCE * 60
        GPIO.setup(self.trigger_pin, GPIO.OUT)
        GPIO.setup(self.echo_pin, GPIO.IN)
        # Initialize line tracking sensor pins
        self.IR01 = 14
        self.IR02 = 15
        self.IR03 = 23
        GPIO.setup(self.IR01, GPIO.IN)
        GPIO.setup(self.IR02, GPIO.IN)
        GPIO.setup(self.IR03, GPIO.IN)
        # Initialize Motor
        self.PWM = Motor()
        self.M = 0
        # Initialize LED
        self.led = Led()
        # Server setup
        self.host = host
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen()
        self.direction = None
        print(f"Server listening on {self.host}:{self.port}")

    def pulseIn(self, pin, level, timeOut):
        t0 = time.time()
        while GPIO.input(pin) != level:
            if (time.time() - t0) > timeOut * 0.000001:
                return 0
        t0 = time.time()
        while GPIO.input(pin) == level:
            if (time.time() - t0) > timeOut * 0.000001:
                return 0
        pulseTime = (time.time() - t0) * 1000000
        return pulseTime

    def get_distance(self):
        distance_cm = [0, 0, 0, 0, 0]
        for i in range(5):
            GPIO.output(self.trigger_pin, GPIO.HIGH)
            time.sleep(0.00001)
            GPIO.output(self.trigger_pin, GPIO.LOW)
            pingTime = self.pulseIn(self.echo_pin, GPIO.HIGH, self.timeOut)
            distance_cm[i] = pingTime * 340.0 / 2.0 / 10000.0
        distance_cm = sorted(distance_cm)
        return int(distance_cm[2])

    def get_temperature(self):
        cpu = CPUTemperature()
        return cpu

    def get_car_status(self):
        # Get the current car status including direction, temperature, and distance
        direction = self.direction
        temperature = self.get_temperature()
        distance = self.get_distance()
        return f"{direction}, {temperature}, {distance}"

    def handle_drive_command(self, command):
        # Handle the driving commands based on w/a/s/d
        if command == "w":  # Move forward
            print("Moving forward")
            self.direction = "forward"
            self.PWM.setMotorModel(1000, 1000, 1000, 1000)
        elif command == "s":  # Move backward
            print("Moving backward")
            self.direction = "backward"
            self.PWM.setMotorModel(-1000, -1000, -1000, -1000)
        elif command == "a":  # Turn left
            print("Turning left")
            self.direction = "left"
            self.PWM.setMotorModel(-500, -500, 1500, 1500)
        elif command == "d":  # Turn right
            print("Turning right")
            self.direction = "right"
            self.PWM.setMotorModel(1500, 1500, -500, -500)
        elif command == "stop":
            print("Stopping")
            self.direction = "stopped"
            self.PWM.setMotorModel(0, 0, 0, 0)
        else:
            print(f"Unknown command: {command}")
            # Stop the car if the command is not recognized
            self.PWM.setMotorModel(0, 0, 0, 0)

    def run(self):
        self.server_socket.setblocking(False)
        inputs = [self.server_socket]
        outputs = []
        message_queues = {}

        while inputs:
            readable, writable, exceptional = select.select(
                inputs, outputs, inputs, 0.1
            )

            for s in readable:
                if s is self.server_socket:
                    client_socket, client_address = s.accept()
                    print(f"New connection from {client_address}")
                    client_socket.setblocking(False)
                    inputs.append(client_socket)
                    message_queues[client_socket] = queue.Queue()
                else:
                    try:
                        data = s.recv(1024).decode().strip().lower()
                        if data:
                            print(f"Received command: {data}")
                            if data in self.command_map:
                                self.handle_drive_command(self.command_map[data])
                            elif data == "0":
                                self.PWM.setMotorModel(
                                    0, 0, 0, 0
                                )  # Stop if no key pressed

                            # Queue the car status to be sent
                            car_status = self.get_car_status()
                            message_queues[s].put(car_status)
                            if s not in outputs:
                                outputs.append(s)
                        else:
                            # Interpret empty result as closed connection
                            print(f"Closing {s.getpeername()}")
                            if s in outputs:
                                outputs.remove(s)
                            inputs.remove(s)
                            s.close()
                            del message_queues[s]
                    except ConnectionResetError:
                        print(f"Connection reset by {s.getpeername()}")
                        if s in outputs:
                            outputs.remove(s)
                        inputs.remove(s)
                        s.close()
                        del message_queues[s]

            for s in writable:
                try:
                    next_msg = message_queues[s].get_nowait()
                except queue.Empty:
                    outputs.remove(s)
                else:
                    print(f"Sending {next_msg} to {s.getpeername()}")
                    s.send(next_msg.encode("utf-8"))

            for s in exceptional:
                print(f"Handling exceptional condition for {s.getpeername()}")
                inputs.remove(s)
                if s in outputs:
                    outputs.remove(s)
                s.close()
                del message_queues[s]

        self.cleanup()

        def cleanup(self):
            self.PWM.setMotorModel(0, 0, 0, 0)
            self.led.colorWipe(self.led.strip, Color(0, 0, 0), 10)
            GPIO.cleanup()


# Main program logic follows:
if __name__ == "__main__":
    car = CombinedCar()
    print("Program is starting ... ")
    try:
        car.run()
    except KeyboardInterrupt:
        car.cleanup()
