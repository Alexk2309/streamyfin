import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { getUserItemData } from "@/utils/jellyfin/user-library/getUserItemData";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useRouter } from "expo-router";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import { TouchableOpacity, View, ViewProps } from "react-native";
import {
  HorizontalScroll,
  HorizontalScrollRef,
} from "../common/HorrizontalScroll";
import ContinueWatchingPoster from "../ContinueWatchingPoster";
import { ItemCardText } from "../ItemCardText";
import { useDownload } from "@/providers/DownloadProvider";

interface Props extends ViewProps {
  item?: BaseItemDto | null;
  loading?: boolean;
  isOffline?: boolean;
}

export const SeasonEpisodesCarousel: React.FC<Props> = ({
  item,
  loading,
  isOffline = false,
  ...props
}) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { downloadedFiles } = useDownload();

  const scrollRef = useRef<HorizontalScrollRef>(null);

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollToIndex(index, 16);
  };

  const seasonId = useMemo(() => {
    return item?.SeasonId;
  }, [item]);

  const fetchEpisodesOnline = async () => {
    if (!api || !user?.Id) return [];
    const response = await api.axiosInstance.get(
      `${api.basePath}/Shows/${item?.Id}/Episodes`,
      {
        params: {
          userId: user?.Id,
          seasonId,
          Fields:
            "ItemCounts,PrimaryImageAspectRatio,CanDelete,MediaSourceCount,Overview",
        },
        headers: {
          Authorization: `MediaBrowser DeviceId="${api.deviceInfo.id}", Token="${api.accessToken}"`,
        },
      }
    );

    return response.data.Items as BaseItemDto[];
  };

  const fetchEpisodesOffline = async () => {
    if (!seasonId) return [];
    const offlineEpisodes = downloadedFiles?.filter(
      (file) => file.SeasonId === seasonId
    ) as BaseItemDto[];
    return offlineEpisodes;
  };

  const {
    data: episodes,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["episodes", seasonId],
    queryFn: isOffline ? fetchEpisodesOffline : fetchEpisodesOnline,
    enabled: !!seasonId,
  });

  const queryClient = useQueryClient();

  const prefetchOnlineEpisodes = () => {
    if (!item?.Id || !item.IndexNumber || !episodes || episodes.length === 0) {
      return;
    }

    const previousId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! - 1
    )?.Id;
    if (previousId) {
      queryClient.prefetchQuery({
        queryKey: ["item", previousId],
        queryFn: async () =>
          await getUserItemData({
            api,
            userId: user?.Id,
            itemId: previousId,
          }),
        staleTime: 60 * 1000 * 5,
      });
    }

    const nextId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! + 1
    )?.Id;
    if (nextId) {
      queryClient.prefetchQuery({
        queryKey: ["item", nextId],
        queryFn: async () =>
          await getUserItemData({
            api,
            userId: user?.Id,
            itemId: nextId,
          }),
        staleTime: 60 * 1000 * 5,
      });
    }
  };

  const prefetchOfflineEpisodes = () => {
    if (!item?.Id || !item.IndexNumber || !episodes || episodes.length === 0) {
      return;
    }

    const previousId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! - 1
    )?.Id;
    const nextId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! + 1
    )?.Id;

    // Prefetch logic for offline mode can be added here if needed
    // For now, we just log the episodes
    console.log("Prefetching offline episodes:", { previousId, nextId });
  };

  const scrollToCurrentEpisode = () => {
    if (item?.Type === "Episode" && item.Id) {
      const index = episodes?.findIndex((ep) => ep.Id === item.Id);
      if (index !== undefined && index !== -1) {
        setTimeout(() => {
          scrollToIndex(index);
        }, 400);
      }
    }
  };

  useEffect(() => {
    if (isOffline) {
      prefetchOfflineEpisodes();
    } else {
      prefetchOnlineEpisodes();
    }
  }, [episodes, api, user?.Id, item, isOffline]);

  useEffect(() => {
    scrollToCurrentEpisode();
  }, [episodes, item]);

  return (
    <HorizontalScroll
      ref={scrollRef}
      data={episodes}
      extraData={item}
      loading={loading || isLoading || isFetching}
      renderItem={(_item, idx) => (
        <TouchableOpacity
          key={_item.Id}
          onPress={() => {
            console.log("Episode clicked:", _item.IndexNumber);
            router.setParams({ id: _item.Id });
          }}
          className={`flex flex-col w-44
                  ${item?.Id === _item.Id ? "" : "opacity-50"}
                `}
        >
          <ContinueWatchingPoster item={_item} useEpisodePoster />
          <ItemCardText item={_item} />
        </TouchableOpacity>
      )}
      {...props}
    />
  );
};
