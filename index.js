document.onkeydown = updateKey;
document.onkeyup = resetKey;

var server_port = 65432;
var server_addr = "192.168.10.59";   // the IP address of your Raspberry PI

function client() {
    const net = require('net');
    var input = document.getElementById("message").value;

    const client = net.createConnection({ port: server_port, host: server_addr }, () => {
        // Send the message to the server (if needed)
        client.write(`${input}\r\n`);
        console.log('connected to server!');
    });

    client.on('error', (err) => {
        console.log(`Connection error: ${err.message}`);
    });

    // Get the data from the server
    client.on('data', (data) => {
        const response = data.toString();
        console.log("Received from server:", response);

        // Assuming server returns values as comma-separated "direction,speed,distance,temperature"
        const [direction, distance, temperature] = response.split(',');

        // Update the HTML with received values
        document.getElementById("direction").innerText = direction || "N/A";
        document.getElementById("distance").innerText = distance || "0.0";
        document.getElementById("temperature").innerText = temperature || "0.0";

        // Close the connection after receiving the data
        //client.end();
        //client.destroy();
    });

    client.on('end', () => {
        console.log('Disconnected from server');
        client.end();
        client.destroy();
    });
}

// for detecting which key is been pressed w,a,s,d
function updateKey(event) {
    // Use the event parameter directly
    if (event.keyCode == '87') { // "W"
        document.getElementById("upArrow").style.color = "green";
        send_data("87");
    }
    else if (event.keyCode == '83') { // "S"
        document.getElementById("downArrow").style.color = "green";
        send_data("83");
    }
    else if (event.keyCode == '65') { // "A"
        document.getElementById("leftArrow").style.color = "green";
        send_data("65");
    }
    else if (event.keyCode == '68') { // "D"
        document.getElementById("rightArrow").style.color = "green";
        send_data("68");
    }
}



// reset the key to the start state 
function resetKey(event) {
    // Reset arrow colors
    document.getElementById("upArrow").style.color = "grey";
    document.getElementById("downArrow").style.color = "grey";
    document.getElementById("leftArrow").style.color = "grey";
    document.getElementById("rightArrow").style.color = "grey";
    
    // Send unique identifier to the server for no key pressed
    console.log("Stopping")
    send_data("0");
}


// update data for every 50ms
function update_data(){
    setInterval(function(){
        // get image from python server
        client();
    }, 50);
}


function send_data(message) {
    const net = require('net');
    const client = net.createConnection({ port: server_port, host: server_addr }, () => {
        // Send the message to the server
        client.write(`${message}\r\n`);
        console.log('Sent to server:', message);
    });

    client.on('data', (data) => {
        document.getElementById("bluetooth").innerHTML = data;
        console.log('Received from server:', data.toString());
        //client.end();
        //client.destroy();
    });

    client.on('end', () => {
        console.log('Disconnected from server');
        client.end();
        client.destroy();
    });

    client.on('error', (err) => {
        console.log('Connection error:', err.message);
    });
}

