# CS Agent Dashboard - Project Planning

## Project Overview
A production-ready AI multi-agent system with a modern chat dashboard integrating multiple platforms including Mattermost, Trello, and Flock.

## Architecture & Goals
- **Framework**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS with consistent design system
- **State Management**: React hooks with WebSocket integration
- **Authentication**: Supabase integration
- **APIs**: RESTful endpoints with real-time capabilities

## Code Structure & Modularity
- **File Size Limit**: Maximum 500 lines per file
- **Organization**: Feature-based modules in `/components`
- **Imports**: Relative imports within packages
- **Reusability**: Shared components in `/components/ui`

## Testing & Reliability
- **Framework**: Pytest for unit tests
- **Coverage**: Expected use, edge cases, failure scenarios
- **Location**: Tests in `/tests` folder mirroring app structure

## Style Conventions
- **Language**: TypeScript with strict typing
- **Formatting**: Prettier + ESLint
- **Components**: Functional components with hooks
- **CSS**: Tailwind utility classes, minimal custom CSS
- **Naming**: PascalCase for components, camelCase for functions

## Mattermost Integration
- **UI Design**: Dark sidebar (#2d3748), light chat area (#ffffff)
- **Layout**: Fixed sidebar (240px), flexible main area
- **Components**: Modular message cards, user avatars, channel navigation
- **Features**: Real-time messaging, file uploads, reactions, threading

## Design System
- **Colors**: 
  - Primary: Blue (#3B82F6)
  - Sidebar: Dark gray (#2D3748)
  - Background: Light gray (#F9FAFB)
  - Text: Dark gray (#111827)
- **Typography**: System fonts with consistent hierarchy
- **Spacing**: 4px grid system (Tailwind defaults)
- **Border Radius**: 6px for cards, 50% for avatars 