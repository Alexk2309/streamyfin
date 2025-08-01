import * as ScreenOrientation from "@/packages/expo-screen-orientation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useAtom } from "jotai";
import React, { useCallback, useEffect, useMemo } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";

import { ItemCardText } from "@/components/ItemCardText";
import { Loader } from "@/components/Loader";
import { Text } from "@/components/common/Text";
import { TouchableItemRouter } from "@/components/common/TouchableItemRouter";
import { FilterButton } from "@/components/filters/FilterButton";
import { ResetFiltersButton } from "@/components/filters/ResetFiltersButton";
import { ItemPoster } from "@/components/posters/ItemPoster";
import { useOrientation } from "@/hooks/useOrientation";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import {
  SortByOption,
  SortOrderOption,
  genreFilterAtom,
  getSortByPreference,
  getSortOrderPreference,
  sortByAtom,
  sortByPreferenceAtom,
  sortOptions,
  sortOrderAtom,
  sortOrderOptions,
  sortOrderPreferenceAtom,
  tagsFilterAtom,
  yearFilterAtom,
} from "@/utils/atoms/filters";
import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client/models";
import {
  getFilterApi,
  getItemsApi,
  getUserLibraryApi,
} from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Page = () => {
  const searchParams = useLocalSearchParams();
  const { libraryId } = searchParams as { libraryId: string };

  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { width: screenWidth } = useWindowDimensions();

  const [selectedGenres, setSelectedGenres] = useAtom(genreFilterAtom);
  const [selectedYears, setSelectedYears] = useAtom(yearFilterAtom);
  const [selectedTags, setSelectedTags] = useAtom(tagsFilterAtom);
  const [sortBy, _setSortBy] = useAtom(sortByAtom);
  const [sortOrder, _setSortOrder] = useAtom(sortOrderAtom);
  const [sortByPreference, setSortByPreference] = useAtom(sortByPreferenceAtom);
  const [sortOrderPreference, setOderByPreference] = useAtom(
    sortOrderPreferenceAtom,
  );

  const { orientation } = useOrientation();

  const { t } = useTranslation();

  useEffect(() => {
    const sop = getSortOrderPreference(libraryId, sortOrderPreference);
    if (sop) {
      _setSortOrder([sop]);
    } else {
      _setSortOrder([SortOrderOption.Ascending]);
    }
    const obp = getSortByPreference(libraryId, sortByPreference);
    if (obp) {
      _setSortBy([obp]);
    } else {
      _setSortBy([SortByOption.SortName]);
    }
  }, []);

  const setSortBy = useCallback(
    (sortBy: SortByOption[]) => {
      const sop = getSortByPreference(libraryId, sortByPreference);
      if (sortBy[0] !== sop) {
        setSortByPreference({ ...sortByPreference, [libraryId]: sortBy[0] });
      }
      _setSortBy(sortBy);
    },
    [libraryId, sortByPreference],
  );

  const setSortOrder = useCallback(
    (sortOrder: SortOrderOption[]) => {
      const sop = getSortOrderPreference(libraryId, sortOrderPreference);
      if (sortOrder[0] !== sop) {
        setOderByPreference({
          ...sortOrderPreference,
          [libraryId]: sortOrder[0],
        });
      }
      _setSortOrder(sortOrder);
    },
    [libraryId, sortOrderPreference],
  );

  const nrOfCols = useMemo(() => {
    if (screenWidth < 300) return 2;
    if (screenWidth < 500) return 3;
    if (screenWidth < 800) return 5;
    if (screenWidth < 1000) return 6;
    if (screenWidth < 1500) return 7;
    return 6;
  }, [screenWidth, orientation]);

  const { data: library, isLoading: isLibraryLoading } = useQuery({
    queryKey: ["library", libraryId],
    queryFn: async () => {
      if (!api) return null;
      const response = await getUserLibraryApi(api).getItem({
        itemId: libraryId,
        userId: user?.Id,
      });
      return response.data;
    },
    enabled: !!api && !!user?.Id && !!libraryId,
    staleTime: 60 * 1000,
  });

  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      title: library?.Name || "",
    });
  }, [library]);

  const fetchItems = useCallback(
    async ({
      pageParam,
    }: {
      pageParam: number;
    }): Promise<BaseItemDtoQueryResult | null> => {
      if (!api || !library) return null;

      let itemType: BaseItemKind | undefined;

      // This fix makes sure to only return 1 type of items, if defined.
      // This is because the underlying directory some times contains other types, and we don't want to show them.
      if (library.CollectionType === "movies") {
        itemType = "Movie";
      } else if (library.CollectionType === "tvshows") {
        itemType = "Series";
      } else if (library.CollectionType === "boxsets") {
        itemType = "BoxSet";
      }

      const response = await getItemsApi(api).getItems({
        userId: user?.Id,
        parentId: libraryId,
        limit: 36,
        startIndex: pageParam,
        sortBy: [sortBy[0], "SortName", "ProductionYear"],
        sortOrder: [sortOrder[0]],
        enableImageTypes: ["Primary", "Backdrop", "Banner", "Thumb"],
        // true is needed for merged versions
        recursive: true,
        imageTypeLimit: 1,
        fields: ["PrimaryImageAspectRatio", "SortName"],
        genres: selectedGenres,
        tags: selectedTags,
        years: selectedYears.map((year) => Number.parseInt(year)),
        includeItemTypes: itemType ? [itemType] : undefined,
      });

      return response.data || null;
    },
    [
      api,
      user?.Id,
      libraryId,
      library,
      selectedGenres,
      selectedYears,
      selectedTags,
      sortBy,
      sortOrder,
    ],
  );

  const { data, isFetching, fetchNextPage, hasNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: [
        "library-items",
        libraryId,
        selectedGenres,
        selectedYears,
        selectedTags,
        sortBy,
        sortOrder,
      ],
      queryFn: fetchItems,
      getNextPageParam: (lastPage, pages) => {
        if (
          !lastPage?.Items ||
          !lastPage?.TotalRecordCount ||
          lastPage?.TotalRecordCount === 0
        )
          return undefined;

        const totalItems = lastPage.TotalRecordCount;
        const accumulatedItems = pages.reduce(
          (acc, curr) => acc + (curr?.Items?.length || 0),
          0,
        );

        if (accumulatedItems < totalItems) {
          return lastPage?.Items?.length * pages.length;
        }
        return undefined;
      },
      initialPageParam: 0,
      enabled: !!api && !!user?.Id && !!library,
    });

  const flatData = useMemo(() => {
    return (
      (data?.pages.flatMap((p) => p?.Items).filter(Boolean) as BaseItemDto[]) ||
      []
    );
  }, [data]);

  const renderItem = useCallback(
    ({ item, index }: { item: BaseItemDto; index: number }) => (
      <TouchableItemRouter
        key={item.Id}
        style={{
          width: "100%",
          marginBottom: 4,
        }}
        item={item}
      >
        <View
          style={{
            alignSelf:
              orientation === ScreenOrientation.OrientationLock.PORTRAIT_UP
                ? index % nrOfCols === 0
                  ? "flex-end"
                  : (index + 1) % nrOfCols === 0
                    ? "flex-start"
                    : "center"
                : "center",
            width: "89%",
          }}
        >
          {/* <MoviePoster item={item} /> */}
          <ItemPoster item={item} />
          <ItemCardText item={item} />
        </View>
      </TouchableItemRouter>
    ),
    [orientation],
  );

  const keyExtractor = useCallback((item: BaseItemDto) => item.Id || "", []);

  const ListHeaderComponent = useCallback(
    () => (
      <View className=''>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            display: "flex",
            paddingHorizontal: 15,
            paddingVertical: 16,
            flexDirection: "row",
          }}
          data={[
            {
              key: "reset",
              component: <ResetFiltersButton />,
            },
            {
              key: "genre",
              component: (
                <FilterButton
                  className='mr-1'
                  id={libraryId}
                  queryKey='genreFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: libraryId,
                    });
                    return response.data.Genres || [];
                  }}
                  set={setSelectedGenres}
                  values={selectedGenres}
                  title={t("library.filters.genres")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "year",
              component: (
                <FilterButton
                  className='mr-1'
                  id={libraryId}
                  queryKey='yearFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: libraryId,
                    });
                    return response.data.Years || [];
                  }}
                  set={setSelectedYears}
                  values={selectedYears}
                  title={t("library.filters.years")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) => item.includes(search)}
                />
              ),
            },
            {
              key: "tags",
              component: (
                <FilterButton
                  className='mr-1'
                  id={libraryId}
                  queryKey='tagsFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: libraryId,
                    });
                    return response.data.Tags || [];
                  }}
                  set={setSelectedTags}
                  values={selectedTags}
                  title={t("library.filters.tags")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "sortBy",
              component: (
                <FilterButton
                  className='mr-1'
                  id={libraryId}
                  queryKey='sortBy'
                  queryFn={async () =>
                    sortOptions
                      .filter(
                        (s) =>
                          library?.CollectionType !== "movies" ||
                          s.key !== SortByOption.DateLastContentAdded,
                      )
                      .map((s) => s.key)
                  }
                  set={setSortBy}
                  values={sortBy}
                  title={t("library.filters.sort_by")}
                  renderItemLabel={(item) =>
                    sortOptions.find((i) => i.key === item)?.value || ""
                  }
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "sortOrder",
              component: (
                <FilterButton
                  className='mr-1'
                  id={libraryId}
                  queryKey='sortOrder'
                  queryFn={async () => sortOrderOptions.map((s) => s.key)}
                  set={setSortOrder}
                  values={sortOrder}
                  title={t("library.filters.sort_order")}
                  renderItemLabel={(item) =>
                    sortOrderOptions.find((i) => i.key === item)?.value || ""
                  }
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
          ]}
          renderItem={({ item }) => item.component}
          keyExtractor={(item) => item.key}
        />
      </View>
    ),
    [
      libraryId,
      api,
      user?.Id,
      selectedGenres,
      setSelectedGenres,
      selectedYears,
      setSelectedYears,
      selectedTags,
      setSelectedTags,
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
      isFetching,
    ],
  );

  const insets = useSafeAreaInsets();

  if (isLoading || isLibraryLoading)
    return (
      <View className='w-full h-full flex items-center justify-center'>
        <Loader />
      </View>
    );

  return (
    <FlashList
      key={orientation}
      ListEmptyComponent={
        <View className='flex flex-col items-center justify-center h-full'>
          <Text className='font-bold text-xl text-neutral-500'>
            {t("library.no_results")}
          </Text>
        </View>
      }
      contentInsetAdjustmentBehavior='automatic'
      data={flatData}
      renderItem={renderItem}
      extraData={[orientation, nrOfCols]}
      keyExtractor={keyExtractor}
      estimatedItemSize={244}
      numColumns={nrOfCols}
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={1}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={{
        paddingBottom: 24,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      ItemSeparatorComponent={() => (
        <View
          style={{
            width: 10,
            height: 10,
          }}
        />
      )}
    />
  );
};

export default React.memo(Page);
