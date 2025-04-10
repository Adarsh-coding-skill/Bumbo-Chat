# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/bumbochat

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV APP_NAME=BumboChat

# Start the application
CMD [ "npm", "start" ] 