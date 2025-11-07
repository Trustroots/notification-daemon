FROM denoland/deno:2.1.4

WORKDIR /app

# Copy all TypeScript files
COPY . .

# Cache dependencies
RUN deno install --entrypoint main.ts

# Run the application
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
