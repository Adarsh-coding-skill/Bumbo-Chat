# BumboChat

A real-time anonymous chat application with interest-based matching and random chat features.

## Features

- Real-time anonymous chat
- Interest-based matching
- Random chat option
- User agreement and age verification
- Responsive design
- Modern UI with animations

## Prerequisites

- Node.js >= 14.0.0
- npm or yarn
- A domain name (for production)
- SSL certificate (for HTTPS)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/bumbochat.git
cd bumbochat
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and configure the environment variables:
```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-session-secret-key
JWT_SECRET=your-jwt-secret-key
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

## Development

Run the development server:
```bash
npm run dev
```

## Production Deployment

### Option 1: Using PM2 (Recommended)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Start the application:
```bash
pm2 start server.js --name "bumbochat"
```

3. Set up PM2 to start on system reboot:
```bash
pm2 startup
pm2 save
```

### Option 2: Using Docker

1. Build the Docker image:
```bash
docker build -t bumbochat .
```

2. Run the container:
```bash
docker run -p 3000:3000 --env-file .env bumbochat
```

## Nginx Configuration (for production)

Create a new file at `/etc/nginx/sites-available/bumbochat.com`:

```nginx
server {
    listen 80;
    server_name bumbochat.com www.bumbochat.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name bumbochat.com www.bumbochat.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring and Maintenance

1. View logs:
```bash
pm2 logs bumbochat
```

2. Monitor application:
```bash
pm2 monit
```

3. Restart application:
```bash
pm2 restart bumbochat
```

## Security Considerations

1. Always use HTTPS in production
2. Keep dependencies updated
3. Monitor logs for suspicious activity
4. Implement rate limiting
5. Use secure session management
6. Regularly backup user data

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@bumbochat.com or create an issue in the repository. 