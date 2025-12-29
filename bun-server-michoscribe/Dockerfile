# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install ffmpeg for audio processing and curl for healthcheck
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies into a temp directory for caching
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies only
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy source code and installed dependencies
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Final production image
FROM base AS release

# Copy files first
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/src ./src
COPY --from=prerelease /app/package.json .
COPY --from=prerelease /app/tsconfig.json .

# Create uploads directory and fix all permissions (chmod ensures files are readable)
RUN mkdir -p /app/uploads && chmod -R 755 /app && chown -R bun:bun /app

# Switch to non-root user for security
USER bun

# Expose the port
EXPOSE 3000

# Run the server
CMD ["bun", "run", "src/index.ts"]
