import ExploreGrid from './ExploreGrid';
import { DataStreamProvider } from '@/contexts/DataStreamProvider';
import { ExploreMsgHandler } from './ExploreMsgHandler';
import { ExploreProvider } from '@/contexts/ExploreProvider';
import { PropsWithChildren } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const Explore = () => {
  return (
    <ExploreContext>
      <div className="flex items-center justify-between mb-4 px-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Discover Tokens
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Launch fair, trade fast, no rugs
          </p>
        </div>
        <Link href="/all-tokens">
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
            See All Tokens →
          </Button>
        </Link>
      </div>
      <ExploreGrid className="flex-1" />
    </ExploreContext>
  );
};

const ExploreContext = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex flex-col h-full">
      <ExploreMsgHandler />

      <ExploreProvider>
        <DataStreamProvider>{children}</DataStreamProvider>
      </ExploreProvider>
    </div>
  );
};

export default Explore;
