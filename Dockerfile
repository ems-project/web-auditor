FROM node:22-alpine

LABEL org.opencontainers.image.source=https://github.com/ems-project/web-auditor
LABEL org.opencontainers.image.description="ElasticMS's Web Auditor"
LABEL org.opencontainers.image.licenses=MIT

COPY --chown=node src /app/src
COPY --chown=node package*.json /app/
COPY --chown=node docker-entrypoint.sh /usr/local/bin/

WORKDIR /app

RUN chmod u+x /usr/local/bin/docker-entrypoint.sh && \
    apk add bash ttf-freefont chromium udev xpdf antiword unrtf poppler-utils tcl-lib tesseract-ocr

USER node

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CRAWLEE_AVAILABLE_MEMORY_RATIO=0.8

RUN mkdir -p ./storage && \
    npm install

ENTRYPOINT ["docker-entrypoint.sh"]