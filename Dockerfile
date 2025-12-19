# TLDR Music - Static Site Container
FROM nginx:alpine

# Copy static files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY about.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY auth.js /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY *.png /usr/share/nginx/html/
COPY *.ico /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
