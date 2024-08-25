FROM node:22-alpine

LABEL org.opencontainers.image.source=https://github.com/ems-project/web-auditor
LABEL org.opencontainers.image.description="ElasticMS's Web Auditor"
LABEL org.opencontainers.image.licenses=MIT

COPY src /app/src
COPY package*.json /app/
COPY docker-entrypoint.sh /usr/local/bin/
RUN mkdir -p /app/node_modules && \
    mkdir -p /app/storage && \
    chown -R node:node /app  && \
    chown node:node /usr/local/bin/docker-entrypoint.sh && \
    chmod u+x /usr/local/bin/docker-entrypoint.sh && \
    apk update && \
    apk upgrade && \
    apk add bash udev ttf-freefont chromium \

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CRAWLEE_AVAILABLE_MEMORY_RATIO=0.8

WORKDIR /app

USER node

RUN npm install

ENTRYPOINT ["docker-entrypoint.sh"]