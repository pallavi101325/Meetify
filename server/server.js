const express = require('express') 
const mongoose = require('mongoose'); 
const app = express();
const http = require("http");
const server = http.createServer(app);
const dotenv = require('dotenv'); 
const socketIO = require('socket.io');

dotenv.config(); 

const port = process.env.PORT || 5000; 


const authRoute = require('./routes/auth'); 

const User = require('./models/User'); 



app.use('/api/user',authRoute); 


const io = socketIO(server);



var SearchPool = function() {
	this.searching = {};
	this.timeouts = {};
}


SearchPool.prototype = {
	constructor: SearchPool,
	
	isEmpty: function(){
		if( _.isEmpty(this.searching) ) return true;
		else return false;
	},
	
	activeSearch:function(user){
		console.log("Trying active search for pID:", user.pID);

		if(!this.isEmpty()){
			
			_.forEachRight(this.searching , (value,key) =>{
			
				if(value.available){
					
					value.available = false;
					
					io.to(user.sID).emit("pID", value.pID);
					io.to(value.sID).emit("pID", user.pID);
				
					delete this.searching[key];
					
					clearTimeout(this.timeouts[key]);
					return ;
				}
			});
		}
	
		else{
			this.passiveSearch(user);
		}
	},
	passiveSearch:function(user){
		console.log("Trying passive search for pID:",user.pID);
		
		this.searching[user.pID] = user;
		this.timeouts[user.pID] = setTimeout( ()=>{
			delete this.searching[user.pID];
			this.activeSearch(user);
		} , 5000)
	},
	
	removeUser(userPID){
		
		clearTimeout(this.timeouts[userPID]);
	
		delete this.searching[userPID];
	}

}

var globalPool = new SearchPool();


io.on('connection', function(socket) {
	console.log("Socket connected, id:", socket.id);
	console.log("All sockets:", Object.keys(io.sockets.connected) );

	
	socket.on('pID', function(data){
		console.log("Received pID", data.pID);
	
		globalPool.activeSearch(data);
		console.log('Global Pool:\n',globalPool.searching);
		socket.pID = data.pID;
	});

	
	socket.on('disconnect',function(){
		console.log('Socket ID:',socket.id,'DISCONNECTED');
		console.log("All sockets:", Object.keys(io.sockets.connected) );
	
		if(socket.pID){
		
			globalPool.removeUser(socket.pID);
		}
	});

	
	socket.on('leaveSearch',function(){
		
		if(socket.pID){
			
			globalPool.removeUser(socket.pID);
		}
	});
});

mongoose.connect(process.env.DB_CONNECT).then(()=>{
    console.log('Database is connected');
    })
    .catch(err =>{
        console.log(err.message);
});

server.listen(port,()=>{
    console.log(`Server is running on ${port}`);
})