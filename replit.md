# replit.md

## Overview

This is a full-stack web application built with Express.js backend and React frontend. The project uses a modern TypeScript-based architecture with PostgreSQL for data persistence. It includes Puppeteer for browser automation/web scraping capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Components**: Radix UI primitives for accessible, unstyled components
- **Styling**: Tailwind CSS with class-variance-authority (CVA) for component variants
- **State Management**: TanStack React Query for server state management
- **Forms**: React Hook Form with Zod resolvers for validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with TSX for TypeScript execution
- **Build Process**: Custom build script (`script/build.ts`) that outputs to `dist/index.cjs`
- **Development**: Hot reload via TSX in development mode

### Data Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (with connect-pg-simple for session storage)
- **Schema Validation**: Drizzle-Zod for generating Zod schemas from database tables
- **Migrations**: Drizzle Kit for schema push operations (`db:push`)

### Browser Automation
- **Tool**: Puppeteer with Chrome
- **Purpose**: Web scraping, screenshots, or automated browser tasks
- **Configuration**: Runs with `--no-sandbox` flags for containerized environments

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via Drizzle ORM
- **Session Store**: connect-pg-simple for Express session persistence

### Browser Automation
- **Google Chrome**: Located at `/usr/bin/google-chrome`, used by Puppeteer
- **Puppeteer**: Headless browser automation library

### UI Component Libraries
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel/slider functionality

### Utility Libraries
- **date-fns**: Date manipulation
- **clsx/CVA**: CSS class management
- **Zod**: Schema validation