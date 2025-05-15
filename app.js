const express = require('express');
const dotenv = require('dotenv');
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config();
const cors = require('cors');
const connectDB = require('./config/mongoose')
const bodyParser = require("body-parser");
const app = express();
const helmet = require('helmet');
const userRoute = require('./routes/userRoute')
const cookieParser = require("cookie-parser");
const { getP2pPrices } = require('./utility/updateP2pPrices');


connectDB()

app.use(helmet({
  contentSecurityPolicy:false,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  expectCt: { maxAge: 86400 },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { policy: "none" },
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true
}));

app.set('trust proxy', 1);

const allowedOrigins = ["http://localhost:5173","http://localhost:3001","http://localhost:4173"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization","X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions)); 
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true })); 
app.use(cookieParser());
app.use(bodyParser.json()); 

app.use('/api',userRoute)

app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.message === 'Not allowed by CORS') {
      res.status(403).send('CORS policy does not allow access from this origin');
    } else {
      console.log("App global err : ", err  );
      
      res.status(500).send('Something broke!');
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Example app listening at http://localhost:${process.env.PORT}`);
})