var express = require('express'),
  app = express(),  // express > 3.0 http server will create by app variable
//socket.io needs server variable hence creating below
// the below 3 lines are for server creation which is automatic in express
//but we need it explicitly in socket.io
  server = require('http').createServer(app),
  io = require('socket.io').listen(server);
  mongoose = require('mongoose'),
  users = {};
  //to implement private message,we need to keep ref of user --> socket so that we can match the image from particular socket
  //nicknames = []

server.listen(3000); // listem to localhost at port no 3000

mongoose.connect('mongodb://localhost/chat', function(err){
  if(err){
    console.log("Cannot connect");
  }
  else{
      console.log("MongoDB connected succesfully");
  }
});

var chatSchema = mongoose.Schema({
  nick: String,
   msg: String,
   created: {type: Date, default: Date.new}
});

var Chat = mongoose.model('Message', chatSchema);

console.log("INFO: socket.io started\n");
app.get('/', function(req, res){
  res.sendFile(__dirname + "/index.html");  // routing root page to index.html
});

//routes in server
io.sockets.on('connection', function(socket){
   var query = Chat.find();
    query.sort('-created').limit(8).exec(function(err,docs){  // descending print
      if(err) throw err;
      socket.emit('load old msgs', docs);
    });

    socket.on('new user',function(data, callback){
      // to check whether name already present
      if (data in users){   // to check name present in map
        callback(false);
      }
      else {
        callback(true);
        socket.nickname = data;
        //nicknames.push(socket.nickname);
        users[socket.nickname] = socket;
        updateNicknames();
      }
    });

    function updateNicknames(){
      for(name in users){
         users[name].emit('usernames', Object.keys(users) , name);  // to send only nicknames to users
      }
    }

    socket.on('send message',function(data, callback){  // send messge is chat name from client side
      var msg = data.trim();
      if(msg.substring(0,3) === '/w '){
        msg = msg.substring(3);  // removing '/w '
        var index = msg.indexOf(' ');
        if(index != -1){
            var name  = msg.substring(0, index);
            var msg  = msg.substring(index + 1);
            if(name in users){
                users[name].emit('whisper', {msg: msg, nick: socket.nickname});
                users[socket.nickname].emit('whisper', {msg: msg, nick: socket.nickname});
            }
            else {
              callback('Error: Enter valid available user for chat currently');
            }
        }
        else{
            callback('Error: Please enter message for your whisper');
        }


      }
      else{
        var newMsg = new Chat({msg: msg, nick: socket.nickname});   // mongodb model class
        newMsg.save(function(err){
        if(err) throw err;
        io.sockets.emit('new message', {msg: msg, nick: socket.nickname}); // new message to broadcast over the network everyone including me
        //socket.broadcast.emit('new message', data);// broadcast everyone except me
        });
      }
    });

    socket.on('disconnect',function(data){
      if(!socket.nickname) return;   // if user exists
      delete users[socket.nickname];  //  to remove that user from socket connection
      //nicknames.splice(nicknames.indexOf(socket.nickname), 1);  // to remove that user from socket connection
      updateNicknames();
    });
});
