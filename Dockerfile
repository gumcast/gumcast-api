
FROM node:19-alpine

LABEL maintainer="HifiWifi LLC"

# Set the working directory
WORKDIR /usr/src/app

RUN echo "@testing https://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
RUN apk add --no-cache pypy@testing

# Copy the rest of your app's source code from your host to your image filesystem.
COPY . .

# Running npm install
RUN npm install --omit=dev

# Create a user group 'nodegroup', create a user 'nodeuser' under 'nodegroup' and chown all the files to the app user.
RUN addgroup -S nodegroup && \
    adduser -S -D -h /usr/src/app nodeuser nodegroup && \
    chown -R nodeuser:nodegroup /usr/src

# Switch to 'nodeuser'
USER nodeuser

# Open the mapped port
EXPOSE 8080

CMD [ "node", "api/bin.js" ]
