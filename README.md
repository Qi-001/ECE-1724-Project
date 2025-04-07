# Study - Collaborative Learning Platform

## Team Information
- Qi Zhang - Student ID: 1010190106 - qqi.zhang@mail.utoronto.ca

## Video Demo
https://drive.google.com/file/d/1PfXUPPCClQ3FrvGUgJ-bEnSwYHbDXfGE/view?usp=sharing

## Motivation
Study is motivated by the need for a seamless collaborative learning environment for students. Traditional study methods often lack collaboration features, making group study sessions less effective, especially in remote settings. This project aims to bridge this gap by providing a platform where students can collaborate on documents, coordinate study sessions, and share resources efficiently.

## Objectives
- Create a robust platform for document collaboration
- Enable effective study group management and coordination
- Facilitate seamless sharing and commentation of study materials
- Integrate calendar functionality for scheduling study sessions
- Provide a user-friendly interface that enhances the learning experience

## Technical Stack
- **Frontend & Backend**: Next.js 15 (Full-Stack approach)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better-Auth
- **Cloud Storage**: Digital Ocean Spaces (S3-compatible)
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Calendar Integration**: Google Calendar API

## Features

### User Authentication
- Secure sign-up and sign-in functionality

### Study Groups
- Create and manage study groups
- Assign group roles (admin, member)
- Share documents within groups

### Document Management
- Upload and organize study materials
- Document viewing
- Comment for documents

### Calendar Integration
- Schedule and manage study events
- Google Calendar synchronization
- Event invitations and response tracking

## User Guide

### Getting Started
1. **Sign Up**: Create an account using your email address
2. **Sign In**: Log in using your credentials
3. **Dashboard**: Navigate to your personal dashboard

### Managing Study Groups
1. Create a new group by providing a name and description
2. Invite members using their email addresses
3. Assign roles to group members
4. Share relevant study materials with the group

### Scheduling Study Sessions
1. Navigate to the study group
2. Create new events by selecting date and time
3. Invite group members or individuals to the event
4. Sync with Google Calendar if desired

## Development Guide

### Environment Setup
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables by creating a `.env` file with the following variables:
   ```
   # Authentication
   BETTER_AUTH_SECRET=your_auth_secret
   BETTER_AUTH_URL=http://localhost:3000

   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/studydb?schema=public"

   # Digital Ocean Spaces (S3)
   DO_SPACES_ENDPOINT=your_spaces_endpoint      # Example:  tor1.digitaloceanspaces.com
   DO_SPACES_KEY=your_spaces_key
   DO_SPACES_SECRET=your_spaces_secret
   DO_SPACES_NAME=your_spaces_bucket     # Example: studydocuments

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Google Calendar Integration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback
   ```

### Database Setup
1. Ensure PostgreSQL is installed and running
2. Create a database named `studydb`
3. Initialize the database using Prisma:
   ```
   npx prisma migrate dev
   ```

### Cloud Storage Configuration
1. Create a Digital Ocean Spaces bucket or use another S3-compatible storage
2. Configure the environment variables as described above

### Google Integration Setup
1. On Google Auth Platform, create a Oauth client
2. Get the client id and secret, configure the environment accordingly.
3. Add "http://localhost:3000/api/calendar/callback" and "http://localhost:3000/api/calendar/events" under Authorized redirect URIs
4. Add google account as audience or set your app status as "In production"
5. Enable Google Calendar API

### Local Development
1. Start the development server:
   ```
   npm run dev
   ```
   This will start the Next.js application
2. Access the application at `http://localhost:3000`


## Individual Contributions
- Qi Zhang: Full-stack development of the application, including:
  - Authentication system
  - Document management
  - Study group functionality
  - Google Calendar integration
  - UI/UX design and implementation
  - Database schema design and implementation
