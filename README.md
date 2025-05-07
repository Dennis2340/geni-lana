# Intelligent Assistant

A full-stack application that combines AI capabilities with blockchain technology to provide intelligent assistance and recommendations.

## Project Overview

This is a modern web application built with TypeScript and React that integrates AI services and blockchain functionality. The application provides features like transaction handling, pool recommendations, and chat functionality.

## Tech Stack

- **Frontend**: React with TypeScript, Vite
- **Backend**: Node.js with Express
- **Database**: Prisma with Neon Database
- **Blockchain**: Solana integration using Anchor
- **UI Components**: Radix UI
- **AI Integration**: OpenAI SDK

## Project Structure

```
├── client/                 # Frontend React application
│   └── src/
│       ├── components/    # React components
│       ├── utils/        # Utility functions
│       └── ...           # Other frontend files
├── server/               # Backend Node.js application
│   ├── routes/          # API routes
│   └── ...              # Other server files
├── shared/              # Shared code between client and server
├── prisma/              # Database schema and migrations
├── migrations/          # Database migration files
└── ...                  # Configuration files
```

## Key Features

- **Transaction Handling**: UI components for handling blockchain transactions
- **Pool Recommendations**: Smart recommendations for pool interactions
- **Chat Interface**: Real-time chat functionality
- **Blockchain Integration**: Solana blockchain integration
- **AI Capabilities**: OpenAI integration for intelligent assistance

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL (via Neon Database)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your API keys and configuration

4. Run the development server:
   ```bash
   # Start frontend in one terminal
   npm run dev
   
   # Start backend in another terminal
   npm run dev:server
   ```

### Database Setup

1. Initialize the database:
   ```bash
   npm run db:push
   ```

2. Run migrations:
   ```bash
   npm run migrate
   ```

## Development

### Available Scripts

- `npm run dev`: Start frontend development server
- `npm run dev:server`: Start backend development server
- `npm run build`: Build both frontend and backend
- `npm run start`: Start production server
- `npm run db:push`: Push database schema changes
- `npm run migrate`: Run database migrations

## Key Functions and Complex Parts

### Pool Recommendations System

The [PoolRecommendations](cci:1://file:///c:/Users/kamar/Downloads/IntelligentAssistant/IntelligentAssistant/client/src/components/PoolRecommendations.tsx:47:0-292:2) component handles complex pool selection logic:

1. **Risk Level-Based Filtering**: Pools are filtered based on user-defined risk levels (1-5)
2. **Dynamic Sorting**: Supports sorting by APR, TVL, and 24h volume
3. **Token Filtering**: Allows filtering by specific token symbols
4. **Data Transformation**: Converts raw pool data into display-friendly format with proper formatting for numbers and percentages
5. **Pagination**: Implements infinite scrolling with 3 pools per page

### Transaction Preview and Simulation

The [TransactionPreview](cci:1://file:///c:/Users/kamar/Downloads/IntelligentAssistant/IntelligentAssistant/client/src/components/TransactionPreview.tsx:40:0-434:2) component handles complex transaction logic:

1. **Risk Level Validation**: Ensures transactions align with user's risk preferences
2. **Price Impact Simulation**: Calculates potential price impact before execution
3. **Network Fee Estimation**: Provides accurate fee estimates for Solana transactions
4. **Wallet Integration**: Handles Phantom wallet connection and transaction signing
5. **APR Estimation**: Provides estimated annual percentage return based on current market conditions

### Complex Data Types

1. **RaydiumPool Interface**: Manages pool data with multiple token pairs and complex fee structures
2. **SimulationResult Type**: Handles transaction simulation with price range calculations and impact analysis
3. **DisplayPool Type**: Transforms raw pool data for UI presentation with proper formatting

### Blockchain Integration

1. **Solana Web3 Integration**: Uses @solana/web3.js for transaction handling
2. **Anchor Framework**: Implements smart contract interactions
3. **Phantom Wallet Integration**: Handles user wallet connections and transaction signing

### AI Integration

1. **Risk Level Analysis**: Uses AI to determine optimal risk levels based on user behavior
2. **Pool Recommendation Engine**: Implements AI-based pool selection algorithm
3. **Transaction Impact Analysis**: Uses AI to predict potential market impact

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
