// Host file for meal planner, serves user data to client

// Import firebase, express js, math js
var firebase = require("firebase")
const express = require('express')
const mathjs = require('mathjs')
var admin = require("firebase-admin");
const fs = require('fs');
var aesjs = require('aes-js');
var request = require("request");

// Configure firebase account
const firebaseConfig = {
  apiKey: "AIzaSyABEw7n7JEwLHOQkBlNbRHQ1C_HY8mS0g0",
  authDomain: "mealplanner-300217.firebaseapp.com",
  databaseURL: "https://mealplanner-300217-default-rtdb.firebaseio.com",
  projectId: "mealplanner-300217",
  storageBucket: "mealplanner-300217.appspot.com",
  messagingSenderId: "261375861782",
  appId: "1:261375861782:web:472b34c14b51ad72e68137",
  measurementId: "G-97PNHV5YYL"
};
firebase.initializeApp(firebaseConfig);

// Fetch the service account key JSON file contents
var serviceAccount = require("./key.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: "https://mealplanner-300217-default-rtdb.firebaseio.com"});
var db = admin.database();

// Set up for express js
const app = express()
var cors = require('cors')
var bodyparser = require('body-parser')
app.use(bodyparser.json({strict: false, limit: '50mb'}), cors())
const port = 3000

// Prime numbers for encryption, sessions object to keep track of user secrets
//const primes = [3,5,7,11,13,17,19,23,  29,31,37,41,43,47,53,59,61,67,71]
const primes = [71]
var sessions = {}

// Get random number between min and max, maximum is exclusive and the minimum is inclusive
function random(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); 
}

// returns a ^ b % c, mathjs is used to prevent javascript from rounding large numbers
function powerModulo(a,b,c) {
  return mathjs.number(mathjs.mod(mathjs.pow(mathjs.bignumber(a),mathjs.bignumber(b)),mathjs.bignumber(c)))
}

// Primitive root modulo generator
function prm(n) {
  for (var r = 2; r < n; r++) {  // Check for roots between 2 and n-1
    var remainders = []
    repeat = false
    for (var x = 0; x < n-1; x++) {  // Test the root with numbers between 0 and n-2
      // remainder = r ^ x % n
      remainder = powerModulo(r,x,n)
      if (remainders.includes(remainder)) {
        repeat = true
        break
      } else {
        remainders.push(remainder)
      }
    }
    if (!repeat) {    // If there are no repeat remainders for a number than that number is a primitive root
      return r
    }
  }
  return -1;
}

// Takes in an integer and returns a 128-bit array to be used as a key for AES
function generate128BitKey(s) {
  var key = []
  for (var i = 0; i < 16; i++) {  // If s is 15 then the array will be: [15, 16, 17, 18, 19...]
    key.push(s + i)
  }
  return key
}

// Encrypts string using s as a key and AES as the cipher
function aesEncrypt(str, s) {
  // Turns our integer key into a 128-bit key
  var key = generate128BitKey(s)
  
  // Converting our text into to bytes
  var textBytes = aesjs.utils.utf8.toBytes(str);
  
  // Encyrypting our bytes using AES Counter mode
  var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5))
  var encryptedBytes = aesCtr.encrypt(textBytes)

  // Converting back to text for easy handling in communication
  var finalResult = aesjs.utils.hex.fromBytes(encryptedBytes)
  return finalResult
}

// Decrypts string using s as a key and AES as the cipher
function aesDecrypt(str, s) {
  // Turns our integer key into a 128-bit key
  var key = generate128BitKey(s)

  // Convert our string back to bytes
  var encryptedBytes = aesjs.utils.hex.toBytes(str);

  // Decrypting our bytes using AES Counter mode
  var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
  var decryptedBytes = aesCtr.decrypt(encryptedBytes);

  // Convert our bytes back into text
  var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
  return decryptedText
}

// Express js listeners

// Part one of Diffie-Hellman key exchange, before the number swap
app.post('/exchange1', (req, res) => {
  var p = primes[random(0, primes.length)]             // Get random prime from array
  var g = prm(p)                                       // Get primitive root modulo p
  var b = random(0,20)                                // Generate random host secret, range is arbitrary, but since this number is in the exponent it needs to be relatively small or else the product will be ridiculously large
  var B = powerModulo(g,b,p)                           // B = g ^ b % p
  sessions[req.body.sessionID] = {p: p, b: b, key: -1} // Save the prime, the prim root modulo, and placeholder for the shared secret
  res.send({p: p, g: g, B: B})
})

// Part two of Diffie-Hellman key exchange, after the number swaap, we now have a shared secret with the client that we can use to unencrypt messages
app.post('/exchange2', (req, res) => {
  session = sessions[req.body.sessionID]      // Retreive session data based on the user's session ID
  A = req.body.A
  key = powerModulo(A, session.b, session.p)    // s = A ^ b % p, calculates our shared secret
  sessions[req.body.sessionID].key = key        // Saved the shared secret for later un-encryption use
})

app.post('/login', (req, res) => {
  key = sessions[req.body.sessionID].key      // Get shared secret
  email = aesDecrypt(req.body.email, key)     // Decrypt email and password
  password = aesDecrypt(req.body.password, key)

  // Fetch user token from firebase
  firebase.auth().signInWithEmailAndPassword(email,password).then((user)=>{
    res.send({"token": user.user.uid})
  }).catch((error) => {   // If their is no user with that email and password, send an error message back to the user
    code = error.code
    res.status(400).send({"message": code})
  })
})

app.post('/signup', (req, res) => {
  key = sessions[req.body.sessionID].key            // Get shared secret
  email = aesDecrypt(req.body.email, key)         // Decrypt email and password
  password = aesDecrypt(req.body.password, key)

  admin.auth().createUser({     // Create user with firebase auth
    email: email,
    emailVerified: false,
    password: password,
    displayName: email,
    disabled: false,
  }).then((userRecord) => {     // If were successful in creating a user, send back to the client a user token
    res.send({"token":userRecord.uid.toString()})
    var ref = db.ref("users")

    // Save user data
    ref.child(userRecord.uid.toString()).set({
      "meals":JSON.parse(fs.readFileSync('./data_collection/output.json')), // Get the meal data from output.json
      "types": ["Breakfast","Lunch","Dinner"],
      "days": {"Sunday": true, "Monday": true, "Tuesday": true, "Wednesday": true, "Thursday": true, "Friday": true, "Saturday": true},
      "calendar": {"default":true},
      "shoppinglist": [0],
      "currentRuleset": 0,
      // Default rules
      "rulesets": [ 
        [
          {
              "select": "day",
              "parameters": ["all"],
              "rules": [
                {
                  "new": true,
                  "rule": "", 
                  "parameters": {}
                },
                {
                  "rule": "Total",
                  "parameters": {
                      "condition": "at most",
                      "amount": 1,
                      "category": "all",
                      "for": "each"
                  }
                },
                {
                    "rule": "Total",
                    "parameters": {
                        "condition": "at most",
                        "amount": 5,
                        "category": "all",
                        "for": "all"
                    }
                },
                {
                    "rule": "Repeats",
                    "parameters": {
                        "amount": 1,
                        "category": "all"
                    }
                }
              ]
          },
          {
              "select": "type",
              "parameters": ["all"],
              "rules": [
                  {
                    "new": true,
                    "rule": "", 
                    "parameters": {}
                  },
                  {
                    "rule": "Repeats",
                    "parameters": {
                        "amount": 1,
                        "category": "all"
                    }
                  }
              ]
          }
        ]
      ]
    })
  }).catch((error) => {         // If there is an error, send back the code to client for the client to interpret
    code = error.errorInfo.code
    res.status(400).send({"message": code});
  })
})

// Returns user data for a given user token
app.post("/user_data", (req, res) => {
  key = sessions[req.body.sessionID].key  // Retreive the user key
  uid = req.body.uid

  var ref = db.ref("users")
  ref.once("value", function(data) {  // Retreives data from firebase and send backs the data encrypted
    data = data.val()[uid]
    res.send({data: aesEncrypt(JSON.stringify(data), key)})
  });
})

// Saves user data for any data given
app.post("/set_data", (req, res) => {
  key = sessions[req.body.sessionID].key  // Retreive the user key
  uid = req.body.uid

  // Iterate through each piece of data and save to firebase if not the user ID or session ID
  updatedData = {}
  Object.keys(req.body).forEach(property => {   
    if (property != "sessionID" && property != "uid") {
      updatedData[property] = JSON.parse(aesDecrypt(req.body[property],key))  // Decrypt each property
    }
  })
  var ref = db.ref("users")
  ref.child(uid).update(updatedData)  // Save to firebase
})

// Sends back the required data for the client to import and parse a recipe url
app.post("/recipe_url", (req, res) => {
  request({uri: req.body.url}, (error, response, body) => {   // Gets the webpage contents
    // Sends back the list of ingredients and the contents of webpage
    res.send({data: body, categories: fs.readFileSync('./data_collection/ingredients.txt', 'utf8')})  
  })
})

// Begins express js listeners
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})