// Assuming this code is part of your ElectronJS renderer process
document.addEventListener("keydown", updateKey);
document.addEventListener("keyup", resetKey);

const net = require('net'); // Make sure Node integration is enabled in Electron

var server_port = 65434;
var server_addr = "192.168.10.59"; // the IP address of your Raspberry Pi

// Global variables
let client = null;
let dataBuffer = Buffer.alloc(0);
let headerParsed = false;
let imageSize = 0;
let totalExpectedBytes = 0;
let keyPressed = false; // Tracks if any key is pressed

// Logging function for consistency
function log(level, message) {
    const levels = {
        'debug': console.debug,
        'info': console.info,
        'warn': console.warn,
        'error': console.error
    };
    (levels[level] || console.log)(`[${level.toUpperCase()}] ${message}`);
}

function updateCharts(distance, temperature) {
    const timestamp = new Date().toLocaleTimeString();

    try {
        // Update distance chart
        if (window.distanceChart) {
            // Copy the current labels and data
            const updatedDistanceLabels = [...window.distanceChart.data.labels, timestamp];
            const updatedDistanceData = [...window.distanceChart.data.datasets[0].data, parseFloat(distance)];
            
            // Ensure the length of the arrays doesn't exceed 20
            const maxLength = 20;
            const finalDistanceLabels = updatedDistanceLabels.length > maxLength
                ? updatedDistanceLabels.slice(-maxLength)   // Keep only the last 20 labels
                : updatedDistanceLabels;
            const finalDistanceData = updatedDistanceData.length > maxLength
                ? updatedDistanceData.slice(-maxLength)     // Keep only the last 20 data points
                : updatedDistanceData;
    
            // Apply the changes back to the chart
            window.distanceChart.data.labels = finalDistanceLabels;
            window.distanceChart.data.datasets[0].data = finalDistanceData;
    
            window.distanceChart.update();
            console.log('Distance chart updated:', distance);
        } else {
            console.warn('Distance chart not initialized');
        }
    
        // Update temperature chart
        if (window.temperatureChart) {
            // Copy the current labels and data
            const updatedTemperatureLabels = [...window.temperatureChart.data.labels, timestamp];
            const updatedTemperatureData = [...window.temperatureChart.data.datasets[0].data, parseFloat(temperature)];
            
            // Ensure the length of the arrays doesn't exceed 20
            const finalTemperatureLabels = updatedTemperatureLabels.length > maxLength
                ? updatedTemperatureLabels.slice(-maxLength)   // Keep only the last 20 labels
                : updatedTemperatureLabels;
            const finalTemperatureData = updatedTemperatureData.length > maxLength
                ? updatedTemperatureData.slice(-maxLength)     // Keep only the last 20 data points
                : updatedTemperatureData;
    
            // Apply the changes back to the chart
            window.temperatureChart.data.labels = finalTemperatureLabels;
            window.temperatureChart.data.datasets[0].data = finalTemperatureData;
    
            window.temperatureChart.update();
            console.log('Temperature chart updated:', temperature);
        } else {
            console.warn('Temperature chart not initialized');
        }
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// Establish a persistent connection to the server
function startClient() {
    client = new net.Socket();

    client.connect(server_port, server_addr, () => {
        log('info', 'Connected to server');
    });

    client.on('data', (data) => {
        log('debug', `Received data chunk of size ${data.length}`);
        processData(data);
    });

    client.on('end', () => {
        log('info', 'Disconnected from server');
    });

    client.on('error', (err) => {
        log('error', `Connection error: ${err.message}`);
    });
}

// Process incoming data from the server
function processData(data) {
    dataBuffer = Buffer.concat([dataBuffer, data]);

    if (!headerParsed) {
        // Check if header is complete (look for '\n\n')
        let headerEndIndex = dataBuffer.indexOf('\n\n');
        if (headerEndIndex !== -1) {
            // Extract header
            let headerBuffer = dataBuffer.slice(0, headerEndIndex);
            let headerStr = headerBuffer.toString('utf-8');
            // Parse header
            let headerLines = headerStr.split('\n');
            if (headerLines.length >= 2) {
                let carStatus = headerLines[0];
                let imageSizeStr = headerLines[1];
                imageSize = parseInt(imageSizeStr);
                if (isNaN(imageSize)) {
                    log('error', 'Invalid image size in header');
                    client.destroy();
                    return;
                }
        
                log('info', `Parsed header: Car Status='${carStatus}', Image Size=${imageSize} bytes`);
        
                // Extract car status
                let [direction, temperature, distance] = carStatus.split(',');
        
                // Update UI
                document.getElementById("direction").innerText = direction || "N/A";
                document.getElementById("distance").innerText = (distance ? distance.trim() + " cm" : "0.0 cm");
                document.getElementById("temperature").innerText = (temperature ? temperature.trim() + " °C" : "0.0 °C");
        
                // Update charts
                updateCharts(distance.trim(), temperature.trim());

                // Set total expected bytes
                totalExpectedBytes = headerEndIndex + 2 + imageSize; // +2 for '\n\n'

                headerParsed = true;
                dataBuffer = dataBuffer.slice(headerEndIndex + 2); // Remove header from buffer
            } else {
                // Incomplete header, wait for more data
                log('warn', 'Incomplete header received, waiting for more data');
                return;
            }
        } else {
            // Header not complete, wait for more data
            log('debug', 'Header not complete, waiting for more data');
            return;
        }
    }

    // Check if we have received all expected data
    if (dataBuffer.length >= imageSize) {
        // Extract image data
        let imageDataBuffer = dataBuffer.slice(0, imageSize);

        // Display the image
        const base64Image = imageDataBuffer.toString('base64');
        document.getElementById('videoFeed').src = 'data:image/jpeg;base64,' + base64Image;
        log('info', 'Image updated on the page');

        // Remove the processed image data from the buffer
        dataBuffer = dataBuffer.slice(imageSize);

        // Reset for next message
        headerParsed = false;
        imageSize = 0;
        totalExpectedBytes = 0;

        // If there's more data in the buffer, process it
        if (dataBuffer.length > 0) {
            log('debug', `Data buffer has ${dataBuffer.length} bytes remaining, processing next message`);
            processData(Buffer.alloc(0)); // Pass an empty buffer to continue processing
        }
    } else {
        log('debug', `Waiting for more image data. Received ${dataBuffer.length}/${imageSize} bytes`);
    }
}

// For detecting which key is being pressed: W, A, S, D
function updateKey(event) {
    keyPressed = true; // Set keyPressed to true when a key is pressed
    // Use event.code to detect the key
    switch (event.code) {
        case "KeyW":
            document.getElementById("upArrow").style.color = "green";
            send_data("87"); // Send W key code
            break;
        case "KeyS":
            document.getElementById("downArrow").style.color = "green";
            send_data("83"); // Send S key code
            break;
        case "KeyA":
            document.getElementById("leftArrow").style.color = "green";
            send_data("65"); // Send A key code
            break;
        case "KeyD":
            document.getElementById("rightArrow").style.color = "green";
            send_data("68"); // Send D key code
            break;
        default:
            // Do nothing for other keys
            break;
    }
}

// Reset the key to the start state
function resetKey(event) {
    // Reset arrow colors
    document.getElementById("upArrow").style.color = "grey";
    document.getElementById("downArrow").style.color = "grey";
    document.getElementById("leftArrow").style.color = "grey";
    document.getElementById("rightArrow").style.color = "grey";

    keyPressed = false; // Set keyPressed to false when no keys are pressed
}

// Continuously send "0" if no key is pressed
setInterval(() => {
    if (!keyPressed) {
        send_data("0"); // Send "0" continuously when no key is pressed
    }
}, 100); // You can adjust the interval time (100 ms in this case)

// Function to send data to the server
function send_data(message) {
    if (client && !client.destroyed) {
        try {
            client.write(`${message}\n`);
            log('info', `Sent to server: ${message}`);
        } catch (err) {
            log('error', `Error sending data: ${err.message}`);
        }
    } else {
        log('warn', 'Client is not connected. Attempting to reconnect...');
        startClient();
        setTimeout(() => {
            if (client && !client.destroyed) {
                client.write(`${message}\n`);
                log('info', `Sent to server after reconnect: ${message}`);
            } else {
                log('error', 'Failed to reconnect to server');
            }
        }, 1000); // Wait for connection to establish
    }
}

// Start the client connection when the application loads
startClient();
