require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://bumbo-chat.vercel.app', 'https://www.bumbo-chat.vercel.app', 'https://bumbo-chat.onrender.com']
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8
});

// Increase server timeout
http.timeout = 60000; // 60 seconds

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

// App configuration
const APP_NAME = 'BumboChat';
const APP_VERSION = '1.0.0';
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Don't exit the process in production, just log it
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:", "http://localhost:3000", "https://bumbo-chat.vercel.app", "https://www.bumbo-chat.vercel.app", "https://bumbo-chat.onrender.com"]
        }
    }
}));

// Enable CORS with more specific options
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://bumbo-chat.vercel.app', 'https://www.bumbo-chat.vercel.app', 'https://bumbo-chat.onrender.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

app.use(compression());

// Rate limiting with higher limits for production
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 100, // limit each IP
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files with caching
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Store connected users and their interests
const users = new Map();
// Store available users by interest
const interestMap = new Map();

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong. Please try again later.' 
            : err.message
    });
});

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        app: APP_NAME,
        version: APP_VERSION,
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

io.on('connection', (socket) => {
    logger.info('A user connected', { socketId: socket.id, app: APP_NAME });

    // Add error handling for socket
    socket.on('error', (error) => {
        logger.error('Socket Error:', error);
        socket.emit('error', 'An error occurred. Please try reconnecting.');
    });

    // Add reconnection handling
    socket.on('reconnect', (attemptNumber) => {
        logger.info('Client reconnected', { socketId: socket.id, attemptNumber });
    });

    socket.on('reconnect_error', (error) => {
        logger.error('Reconnection Error:', error);
    });

    socket.on('join', (data) => {
        const { interests, matchType } = data;
        // Store user with their interests
        users.set(socket.id, {
            interests: new Set(interests),
            socket,
            connected: false,
            matchType,
            timeoutId: null
        });

        // Add user to interest map if using interest-based matching
        if (matchType === 'interest') {
            interests.forEach(interest => {
                if (!interestMap.has(interest)) {
                    interestMap.set(interest, new Set());
                }
                interestMap.get(interest).add(socket.id);
            });
        }
        
        // Try to find a match based on the selected match type
        const match = matchType === 'interest' ? findMatch(socket.id, interests) : findRandomMatch(socket.id);
        
        if (match) {
            // Mark both users as connected
            users.get(socket.id).connected = true;
            users.get(match).connected = true;
            
            // Find common interests if using interest-based matching
            let commonInterests = [];
            if (matchType === 'interest') {
                const user1Interests = users.get(socket.id).interests;
                const user2Interests = users.get(match).interests;
                commonInterests = Array.from(user1Interests).filter(interest => user2Interests.has(interest));
            }
            
            // Notify both users
            socket.emit('matched', { 
                partnerId: match,
                matchType: matchType,
                commonInterests: commonInterests
            });
            users.get(match).socket.emit('matched', { 
                partnerId: socket.id,
                matchType: matchType,
                commonInterests: commonInterests
            });
            
            logger.info('Users matched', { 
                user1: socket.id, 
                user2: match, 
                matchType: matchType 
            });
        } else if (matchType === 'interest') {
            // Set up the 10-second timeout
            const timeoutId = setTimeout(() => {
                const user = users.get(socket.id);
                if (user && !user.connected) {
                    // Clean up user data
                    user.interests.forEach(interest => {
                        if (interestMap.has(interest)) {
                            interestMap.get(interest).delete(socket.id);
                            if (interestMap.get(interest).size === 0) {
                                interestMap.delete(interest);
                            }
                        }
                    });
                    users.delete(socket.id);
                    socket.emit('noMatchFound');
                    logger.info('No match found for user', { socketId: socket.id });
                }
            }, 10000);

            // Store the timeout ID
            users.get(socket.id).timeoutId = timeoutId;

            // After 8 seconds, try different interest and random matching
            setTimeout(() => {
                const user = users.get(socket.id);
                if (user && !user.connected) {
                    // First try to find someone with different interests
                    const differentInterestMatch = findDifferentInterestMatch(socket.id, interests);
                    if (differentInterestMatch) {
                        clearTimeout(user.timeoutId);
                        user.connected = true;
                        users.get(differentInterestMatch).connected = true;
                        
                        socket.emit('matched', { 
                            partnerId: differentInterestMatch,
                            matchType: 'different',
                            commonInterests: []
                        });
                        users.get(differentInterestMatch).socket.emit('matched', { 
                            partnerId: socket.id,
                            matchType: 'different',
                            commonInterests: []
                        });
                    } else {
                        // If no different interest match found, try random matching
                        const randomMatch = findRandomMatch(socket.id);
                        if (randomMatch) {
                            clearTimeout(user.timeoutId);
                            user.connected = true;
                            users.get(randomMatch).connected = true;
                            
                            socket.emit('matched', { 
                                partnerId: randomMatch,
                                matchType: 'random',
                                commonInterests: []
                            });
                            users.get(randomMatch).socket.emit('matched', { 
                                partnerId: socket.id,
                                matchType: 'random',
                                commonInterests: []
                            });
                        }
                    }
                }
            }, 8000);
        }
    });

    socket.on('message', (data) => {
        const { message, to } = data;
        if (users.has(to) && users.get(to).connected) {
            users.get(to).socket.emit('message', {
                from: socket.id,
                message
            });
            logger.debug('Message sent', { from: socket.id, to: to });
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // Clear any pending timeout
            if (user.timeoutId) {
                clearTimeout(user.timeoutId);
            }
            
            // Remove user from interest map if using interest-based matching
            if (user.matchType === 'interest') {
                user.interests.forEach(interest => {
                    if (interestMap.has(interest)) {
                        interestMap.get(interest).delete(socket.id);
                        if (interestMap.get(interest).size === 0) {
                            interestMap.delete(interest);
                        }
                    }
                });
            }
            
            // Notify partner if connected
            if (user.connected) {
                const partner = findPartner(socket.id);
                if (partner) {
                    users.get(partner).connected = false;
                    users.get(partner).socket.emit('partnerDisconnected');
                    logger.info('Partner disconnected', { 
                        user: socket.id, 
                        partner: partner 
                    });
                }
            }
            users.delete(socket.id);
        }
        logger.info('User disconnected', { socketId: socket.id });
    });

    socket.on('disconnectPartner', (data) => {
        const { partnerId } = data;
        const user = users.get(socket.id);
        const partner = users.get(partnerId);
        
        if (user && partner) {
            // Mark both users as disconnected
            user.connected = false;
            partner.connected = false;
            
            // Notify the partner that they were disconnected
            partner.socket.emit('partnerDisconnected');
            logger.info('Users disconnected by request', { 
                user: socket.id, 
                partner: partnerId 
            });
        }
    });

    socket.on('findNewPartner', () => {
        const user = users.get(socket.id);
        if (user && !user.connected) {
            const match = user.matchType === 'interest' 
                ? findMatch(socket.id, Array.from(user.interests))
                : findRandomMatch(socket.id);
            
            if (match) {
                users.get(socket.id).connected = true;
                users.get(match).connected = true;
                
                // Find common interests if using interest-based matching
                let commonInterests = [];
                if (user.matchType === 'interest') {
                    const user1Interests = users.get(socket.id).interests;
                    const user2Interests = users.get(match).interests;
                    commonInterests = Array.from(user1Interests).filter(interest => user2Interests.has(interest));
                }
                
                socket.emit('matched', { 
                    partnerId: match,
                    matchType: user.matchType,
                    commonInterests: commonInterests
                });
                users.get(match).socket.emit('matched', { 
                    partnerId: socket.id,
                    matchType: user.matchType,
                    commonInterests: commonInterests
                });
                logger.info('New partner found', { 
                    user: socket.id, 
                    partner: match, 
                    matchType: user.matchType 
                });
            }
        }
    });
});

function findMatch(userId, interests) {
    // First try to find a match with common interests
    for (const interest of interests) {
        if (interestMap.has(interest)) {
            const potentialMatches = interestMap.get(interest);
            for (const matchId of potentialMatches) {
                if (matchId !== userId && !users.get(matchId).connected) {
                    return matchId;
                }
            }
        }
    }
    return null;
}

function findRandomMatch(userId) {
    const availableUsers = Array.from(users.keys()).filter(id => 
        id !== userId && !users.get(id).connected
    );
    return availableUsers[Math.floor(Math.random() * availableUsers.length)];
}

function findPartner(userId) {
    for (const [id, user] of users.entries()) {
        if (id !== userId && user.connected) {
            return id;
        }
    }
    return null;
}

// Add new function to find matches with different interests
function findDifferentInterestMatch(userId, interests) {
    const userInterests = new Set(interests);
    for (const [id, user] of users.entries()) {
        if (id !== userId && !user.connected) {
            const hasCommonInterest = Array.from(user.interests).some(interest => userInterests.has(interest));
            if (!hasCommonInterest) {
                return id;
            }
        }
    }
    return null;
}

// Start server with error handling
const server = http.listen(PORT, () => {
    logger.info(`${APP_NAME} v${APP_VERSION} is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
}).on('error', (error) => {
    logger.error('Server Error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Performing graceful shutdown...');
    server.close(() => {
        logger.info('Server closed. Exiting process.');
        process.exit(0);
    });
});

// Export for Vercel
module.exports = http; 