# Docker Setup for Procurement System

This document outlines how to run the Procurement System using Docker. 
Everything is fully dockerized (Express.js App + MySQL 8.0).

## Prerequisites
- **Docker Desktop** installed and running.
- Ensure ports `3000` (for the API) and `3306` (for MySQL) are free on your host machine.

## Quick Start
1. Ensure Docker Desktop is running.
2. In your terminal, navigate to the project directory.
3. Run the following command to start both the application and the database:
   ```bash
   docker compose up -d
   ```
4. Access the API at `http://localhost:3000/`.

## Available Commands

Here are the most common Docker commands you will need:

- **Start containers in background:**
  ```bash
  docker compose up -d
  ```

- **Stop containers:**
  ```bash
  docker compose down
  ```

- **Stop containers and wipe database data (clean slate):**
  ```bash
  docker compose down -v
  ```

- **Rebuild the application image (useful after making code changes or installing new npm packages):**
  ```bash
  docker compose up -d --build
  ```

- **View application logs:**
  ```bash
  docker compose logs -f app
  ```

- **Execute a command inside the running app container:**
  ```bash
  docker compose exec app sh
  ```

## Connecting to MySQL GUI (TablePlus, DBeaver, etc.)

You can connect to the MySQL database from your host machine using any GUI tool:

- **Host:** `localhost`
- **Port:** `3306`
- **Username:** `root` (or as defined in `.env` `DB_USER`)
- **Password:** `password123` (or as defined in `.env` `DB_PASSWORD`)
- **Database:** `procurement_db` (or as defined in `.env` `DB_NAME`)

## Running Database Migrations

The database is automatically initialized with the schema and sample data on the first run using the `docker/init.sql` script.

If you need to run custom SQL scripts or interact with the database directly from the terminal, you can access the MySQL prompt inside the container:
```bash
docker compose exec db mysql -u root -p
```
*(Enter your DB_PASSWORD when prompted)*

If you have migration scripts you want to execute inside the app container, you can do so by running:
```bash
docker compose exec app node <path-to-migration-script.js>
```
