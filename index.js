document.onkeydown = updateKey;
document.onkeyup = resetKey;

var server_port = 65432;
var server_addr = "192.168.10.59";   // the IP address of your Raspberry PI

function client(){
    
    const net = require('net');
    var input = document.getElementById("message").value;

    const client = net.createConnection({ port: server_port, host: server_addr }, () => {
        // 'connect' listener.
        console.log('connected to server!');
        // send the message
        client.write(`${input}\r\n`);
    });
    
        client.on('error', (err) => {
        console.log(`Connection error: ${err.message}`);
    });

    // get the data from the server
    client.on('data', (data) => {
        document.getElementById("bluetooth").innerHTML = data;
        console.log(data.toString());
        client.end();
        client.destroy();
    });

    client.on('end', () => {
        console.log('disconnected from server');
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
function resetKey(e) {

    e = e || window.event;

    document.getElementById("upArrow").style.color = "grey";
    document.getElementById("downArrow").style.color = "grey";
    document.getElementById("leftArrow").style.color = "grey";
    document.getElementById("rightArrow").style.color = "grey";
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
        client.end();
        client.destroy();
    });

    client.on('end', () => {
        console.log('Disconnected from server');
    });

    client.on('error', (err) => {
        console.log('Connection error:', err.message);
    });
}
