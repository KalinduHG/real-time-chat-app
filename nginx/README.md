# NGINX Configuration

## Description
NGINX is used as a reverse proxy to route requests between the frontend and backend, and to serve the frontend ReactJS application.

## Prerequisites
- NGINX installed on your Windows system

## Setup Instructions
1. Locate the NGINX installation directory
    ```bash
    C:\nginx

2. Copy the `nginx.conf` file to your NGINX configuration directory:
   ```bash
   C:\nginx\conf

3. Start NGINX
    ```bash
   start nginx

4. Verify setup 
    Open a browser and navigate to 
    ```arduino
    http://localhost
    ```
    Ensure the frontend loads, and API calls
