import { Button } from "@/components/Button";
import { Loader } from "@/components/Loader";
import { Text } from "@/components/common/Text";
import { LargeMovieCarousel } from "@/components/home/LargeMovieCarousel";
import { ScrollingCollectionList } from "@/components/home/ScrollingCollectionList";
import { MediaListSection } from "@/components/medialists/MediaListSection";
import { Colors } from "@/constants/Colors";
import { useInvalidatePlaybackProgressCache } from "@/hooks/useRevalidatePlaybackProgressCache";
import { useDownload } from "@/providers/DownloadProvider";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { eventBus } from "@/utils/eventBus";
import { Feather, Ionicons } from "@expo/vector-icons";
import type { Api } from "@jellyfin/sdk";
import type {
  BaseItemDto,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client/models";
import {
  getItemsApi,
  getSuggestionsApi,
  getTvShowsApi,
  getUserLibraryApi,
  getUserViewsApi,
} from "@jellyfin/sdk/lib/utils/api";
import NetInfo from "@react-native-community/netinfo";
import { type QueryFunction, useQuery } from "@tanstack/react-query";
import {
  useNavigation,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScrollingCollectionListSection = {
  type: "ScrollingCollectionList";
  title?: string;
  queryKey: (string | undefined | null)[];
  queryFn: QueryFunction<BaseItemDto[]>;
  orientation?: "horizontal" | "vertical";
};

type MediaListSectionType = {
  type: "MediaListSection";
  queryKey: (string | undefined)[];
  queryFn: QueryFunction<BaseItemDto>;
};

type Section = ScrollingCollectionListSection | MediaListSectionType;

export const HomeIndex = () => {
  const router = useRouter();

  const { t } = useTranslation();

  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);

  const [loading, setLoading] = useState(false);
  const [
    settings,
    updateSettings,
    pluginSettings,
    setPluginSettings,
    refreshStreamyfinPluginSettings,
  ] = useSettings();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loadingRetry, setLoadingRetry] = useState(false);

  const navigation = useNavigation();

  const insets = useSafeAreaInsets();

  const scrollViewRef = useRef<ScrollView>(null);

  const { downloadedFiles, cleanCacheDirectory } = useDownload();
  useEffect(() => {
    if (Platform.isTV) {
      navigation.setOptions({
        headerLeft: () => null,
      });
      return;
    }
    const hasDownloads = downloadedFiles && downloadedFiles.length > 0;
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            router.push("/(auth)/downloads");
          }}
          className='p-2'
        >
          <Feather
            name='download'
            color={hasDownloads ? Colors.primary : "white"}
            size={22}
          />
        </TouchableOpacity>
      ),
    });
  }, [downloadedFiles, navigation, router]);

  useEffect(() => {
    cleanCacheDirectory().catch((e) =>
      console.error("Something went wrong cleaning cache directory"),
    );
  }, []);

  const segments = useSegments();
  useEffect(() => {
    const unsubscribe = eventBus.on("scrollToTop", () => {
      if (segments[2] === "(home)")
        scrollViewRef.current?.scrollTo({ y: -152, animated: true });
    });

    return () => {
      unsubscribe();
    };
  }, [segments]);

  const checkConnection = useCallback(async () => {
    setLoadingRetry(true);
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected);
    setLoadingRetry(false);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false || state.isInternetReachable === false)
        setIsConnected(false);
      else setIsConnected(true);
    });

    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
    });

    // cleanCacheDirectory().catch((e) =>
    //   console.error("Something went wrong cleaning cache directory")
    // );

    return () => {
      unsubscribe();
    };
  }, []);

  const {
    data,
    isError: e1,
    isLoading: l1,
  } = useQuery({
    queryKey: ["home", "userViews", user?.Id],
    queryFn: async () => {
      if (!api || !user?.Id) {
        return null;
      }

      const response = await getUserViewsApi(api).getUserViews({
        userId: user.Id,
      });

      return response.data.Items || null;
    },
    enabled: !!api && !!user?.Id,
    staleTime: 60 * 1000,
  });

  const userViews = useMemo(
    () => data?.filter((l) => !settings?.hiddenLibraries?.includes(l.Id!)),
    [data, settings?.hiddenLibraries],
  );

  const collections = useMemo(() => {
    const allow = ["movies", "tvshows"];
    return (
      userViews?.filter(
        (c) => c.CollectionType && allow.includes(c.CollectionType),
      ) || []
    );
  }, [userViews]);

  const invalidateCache = useInvalidatePlaybackProgressCache();

  const refetch = async () => {
    setLoading(true);
    await refreshStreamyfinPluginSettings();
    await invalidateCache();
    setLoading(false);
  };

  const createCollectionConfig = useCallback(
    (
      title: string,
      queryKey: string[],
      includeItemTypes: BaseItemKind[],
      parentId: string | undefined,
    ): ScrollingCollectionListSection => ({
      title,
      queryKey,
      queryFn: async () => {
        if (!api) return [];

        const response = await getItemsApi(api).getItems({
          userId: user?.Id,
          limit: 40,
          recursive: true,
          includeItemTypes,
          sortBy: ["DateCreated"],
          sortOrder: ["Descending"],
          fields: ["PrimaryImageAspectRatio", "Path"],
          parentId,
          enableImageTypes: ["Primary", "Backdrop", "Thumb"],
        });

        let items = response.data.Items || [];

        if (includeItemTypes.includes("Episode")) {
          // Removes individual episodes from the list if they are part of a series
          //    and only keeps the series item
          // Note: The 'Latest' API endpoint does not work well with combining batch episode imports
          //    and will either only show the series or the episodes, not both.
          //    This is a workaround to filter out the episodes from the list
          const seriesIds = new Set(
            items.filter((i) => i.Type === "Series").map((i) => i.Id),
          );

          items = items.filter(
            (i) =>
              i.Type === "Series" ||
              (i.Type === "Episode" && !seriesIds.has(i.SeriesId!)),
          );
        }

        if (items.length > 20) {
          items = items.slice(0, 20);
        }

        return items;
      },
      type: "ScrollingCollectionList",
    }),
    [api, user?.Id],
  );

  let sections: Section[] = [];
  if (!settings?.home || !settings?.home?.sections) {
    sections = useMemo(() => {
      if (!api || !user?.Id) return [];

      const latestMediaViews = collections.map((c) => {
        const includeItemTypes: BaseItemKind[] =
          c.CollectionType === "tvshows" ? ["Episode", "Series"] : ["Movie"];
        const title = t("home.recently_added_in", { libraryName: c.Name });
        const queryKey = [
          "home",
          `recentlyAddedIn${c.CollectionType}`,
          user?.Id!,
          c.Id!,
        ];
        return createCollectionConfig(
          title || "",
          queryKey,
          includeItemTypes,
          c.Id,
        );
      });

      const ss: Section[] = [
        {
          title: t("home.continue_watching"),
          queryKey: ["home", "resumeItems"],
          queryFn: async () =>
            (
              await getItemsApi(api).getResumeItems({
                userId: user.Id,
                enableImageTypes: ["Primary", "Backdrop", "Thumb"],
                includeItemTypes: ["Movie", "Series", "Episode"],
              })
            ).data.Items || [],
          type: "ScrollingCollectionList",
          orientation: "horizontal",
        },
        {
          title: t("home.next_up"),
          queryKey: ["home", "nextUp-all"],
          queryFn: async () =>
            (
              await getTvShowsApi(api).getNextUp({
                userId: user?.Id,
                fields: ["MediaSourceCount"],
                limit: 20,
                enableImageTypes: ["Primary", "Backdrop", "Thumb"],
                enableResumable: false,
              })
            ).data.Items || [],
          type: "ScrollingCollectionList",
          orientation: "horizontal",
        },
        ...latestMediaViews,
        // ...(mediaListCollections?.map(
        //   (ml) =>
        //     ({
        //       title: ml.Name,
        //       queryKey: ["home", "mediaList", ml.Id!],
        //       queryFn: async () => ml,
        //       type: "MediaListSection",
        //       orientation: "vertical",
        //     } as Section)
        // ) || []),
        {
          title: t("home.suggested_movies"),
          queryKey: ["home", "suggestedMovies", user?.Id],
          queryFn: async () =>
            (
              await getSuggestionsApi(api).getSuggestions({
                userId: user?.Id,
                limit: 10,
                mediaType: ["Video"],
                type: ["Movie"],
              })
            ).data.Items || [],
          type: "ScrollingCollectionList",
          orientation: "vertical",
        },
        {
          title: t("home.suggested_episodes"),
          queryKey: ["home", "suggestedEpisodes", user?.Id],
          queryFn: async () => {
            try {
              const suggestions = await getSuggestions(api, user.Id);
              const nextUpPromises = suggestions.map((series) =>
                getNextUp(api, user.Id, series.Id),
              );
              const nextUpResults = await Promise.all(nextUpPromises);

              return nextUpResults.filter((item) => item !== null) || [];
            } catch (error) {
              console.error("Error fetching data:", error);
              return [];
            }
          },
          type: "ScrollingCollectionList",
          orientation: "horizontal",
        },
      ];
      return ss;
    }, [api, user?.Id, collections]);
  } else {
    sections = useMemo(() => {
      if (!api || !user?.Id) return [];
      const ss: Section[] = [];

      for (const key in settings.home?.sections) {
        // @ts-expect-error
        const section = settings.home?.sections[key];
        const id = section.title || key;
        ss.push({
          title: id,
          queryKey: ["home", id],
          queryFn: async () => {
            if (section.items) {
              const response = await getItemsApi(api).getItems({
                userId: user?.Id,
                limit: section.items?.limit || 25,
                recursive: true,
                includeItemTypes: section.items?.includeItemTypes,
                sortBy: section.items?.sortBy,
                sortOrder: section.items?.sortOrder,
                filters: section.items?.filters,
                parentId: section.items?.parentId,
              });
              return response.data.Items || [];
            }
            if (section.nextUp) {
              const response = await getTvShowsApi(api).getNextUp({
                userId: user?.Id,
                fields: ["MediaSourceCount"],
                limit: section.nextUp?.limit || 25,
                enableImageTypes: ["Primary", "Backdrop", "Thumb"],
                enableResumable: section.nextUp?.enableResumable,
                enableRewatching: section.nextUp?.enableRewatching,
              });
              return response.data.Items || [];
            }

            if (section.latest) {
              const response = await getUserLibraryApi(api).getLatestMedia({
                userId: user?.Id,
                includeItemTypes: section.latest?.includeItemTypes,
                limit: section.latest?.limit || 25,
                isPlayed: section.latest?.isPlayed,
                groupItems: section.latest?.groupItems,
              });
              return response.data || [];
            }
            return [];
          },
          type: "ScrollingCollectionList",
          orientation: section?.orientation || "vertical",
        });
      }
      return ss;
    }, [api, user?.Id, settings.home?.sections]);
  }

  if (isConnected === false) {
    return (
      <View className='flex flex-col items-center justify-center h-full -mt-6 px-8'>
        <Text className='text-3xl font-bold mb-2'>{t("home.no_internet")}</Text>
        <Text className='text-center opacity-70'>
          {t("home.no_internet_message")}
        </Text>
        <View className='mt-4'>
          <Button
            color='purple'
            onPress={() => router.push("/(auth)/downloads")}
            justify='center'
            iconRight={
              <Ionicons name='arrow-forward' size={20} color='white' />
            }
          >
            {t("home.go_to_downloads")}
          </Button>
          <Button
            color='black'
            onPress={() => {
              checkConnection();
            }}
            justify='center'
            className='mt-2'
            iconRight={
              loadingRetry ? null : (
                <Ionicons name='refresh' size={20} color='white' />
              )
            }
          >
            {loadingRetry ? (
              <ActivityIndicator size={"small"} color={"white"} />
            ) : (
              "Retry"
            )}
          </Button>
        </View>
      </View>
    );
  }

  if (e1)
    return (
      <View className='flex flex-col items-center justify-center h-full -mt-6'>
        <Text className='text-3xl font-bold mb-2'>{t("home.oops")}</Text>
        <Text className='text-center opacity-70'>
          {t("home.error_message")}
        </Text>
      </View>
    );

  if (l1)
    return (
      <View className='justify-center items-center h-full'>
        <Loader />
      </View>
    );

  return (
    <ScrollView
      scrollToOverflowEnabled={true}
      ref={scrollViewRef}
      nestedScrollEnabled
      contentInsetAdjustmentBehavior='automatic'
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refetch} />
      }
      contentContainerStyle={{
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: 16,
      }}
    >
      <View className='flex flex-col space-y-4'>
        <LargeMovieCarousel />

        {sections.map((section, index) => {
          if (section.type === "ScrollingCollectionList") {
            return (
              <ScrollingCollectionList
                key={index}
                title={section.title}
                queryKey={section.queryKey}
                queryFn={section.queryFn}
                orientation={section.orientation}
                hideIfEmpty
              />
            );
          }
          if (section.type === "MediaListSection") {
            return (
              <MediaListSection
                key={index}
                queryKey={section.queryKey}
                queryFn={section.queryFn}
              />
            );
          }
          return null;
        })}
      </View>
    </ScrollView>
  );
};

// Function to get suggestions
async function getSuggestions(api: Api, userId: string | undefined) {
  if (!userId) return [];
  const response = await getSuggestionsApi(api).getSuggestions({
    userId,
    limit: 10,
    mediaType: ["Unknown"],
    type: ["Series"],
  });
  return response.data.Items ?? [];
}

// Function to get the next up TV show for a series
async function getNextUp(
  api: Api,
  userId: string | undefined,
  seriesId: string | undefined,
) {
  if (!userId || !seriesId) return null;
  const response = await getTvShowsApi(api).getNextUp({
    userId,
    seriesId,
    limit: 1,
  });
  return response.data.Items?.[0] ?? null;
}
