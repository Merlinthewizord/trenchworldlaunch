import { useInfiniteQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { memo } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';

import { BottomPanelTab, bottomPanelTabAtom } from './config';
import { useTokenInfo } from '@/hooks/queries';
import { ReadableNumber } from '../ui/ReadableNumber';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { cn } from '@/lib/utils';
import { TxnsTab } from './TxnsTab';
import { HoldersTab } from './HoldersTab';
import { CreatorFeesTab } from './CreatorFeesTab';

type TokenBottomPanelProps = {
  className?: string;
};

export const TokenBottomPanel: React.FC<TokenBottomPanelProps> = memo(({ className }) => {
  const [tab, setTab] = useAtom(bottomPanelTabAtom);
  const { publicKey } = useWallet();
  const { data: tokenData } = useTokenInfo();

  console.log('Data in TokenBottomPanel:', tokenData);
  const isCreator = publicKey && tokenData?.baseAsset?.dev && publicKey.toBase58() === tokenData.baseAsset.dev;

  return (
    <Tabs
      className={cn('overflow-hidden', className)}
      value={tab}
      onValueChange={(value) => setTab(value as BottomPanelTab)}
    >
      <div className="flex items-center justify-between border-b border-neutral-850 pr-2">
        <TabsList className="scrollbar-none flex h-10 w-full items-center text-sm">
          <TabsTrigger value={BottomPanelTab.TXNS}>
            <span className="sm:hidden">{`Txns`}</span>
            <span className="max-sm:hidden">{`Transactions`}</span>
          </TabsTrigger>

          <TabsTrigger value={BottomPanelTab.HOLDERS}>
            <span>{`Holders`}</span>
          </TabsTrigger>

          {isCreator && (
            <TabsTrigger value={BottomPanelTab.CREATOR_FEES}>
              <span>{`Creator Fees`}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      <TabsContent className="contents" value={BottomPanelTab.TXNS}>
        <TxnsTab />
      </TabsContent>

      <TabsContent className="contents" value={BottomPanelTab.HOLDERS}>
        <HoldersTab />
      </TabsContent>

      {isCreator && (
        <TabsContent className="contents" value={BottomPanelTab.CREATOR_FEES}>
          <CreatorFeesTab />
        </TabsContent>
      )}
    </Tabs>
  );
});

TokenBottomPanel.displayName = 'TokenBottomPanel';
