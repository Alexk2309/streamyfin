import { Text } from "@/components/common/Text";
import MoviePoster from "@/components/posters/MoviePoster";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ScrollView, View, ViewProps } from "react-native";
import ContinueWatchingPoster from "../ContinueWatchingPoster";
import { ItemCardText } from "../ItemCardText";
import { TouchableItemRouter } from "../common/TouchableItemRouter";
import SeriesPoster from "../posters/SeriesPoster";

interface Props extends ViewProps {
  title?: string | null;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  downloads: BaseItemDto[];
}

export const DownloadScrollingCollection: React.FC<Props> = ({
  title,
  orientation = "vertical",
  disabled = false,
  downloads = [],
  ...props
}) => {
  return (
    <View {...props} className="">
      <Text className="px-4 text-lg font-bold mb-2 text-neutral-100">
        {title}
      </Text>
      {downloads.length === 0 && (
        <View className="px-4">
          <Text className="text-neutral-500">No items</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="px-4 flex flex-row">
          {downloads.map((item, index) => (
            <TouchableItemRouter
              item={item}
              key={index}
              className={`
              mr-2 
              ${orientation === "horizontal" ? "w-44" : "w-28"}
            `}
            >
              {item.Type === "Episode" && orientation === "horizontal" && (
                <ContinueWatchingPoster item={item} />
              )}
              {item.Type === "Episode" && orientation === "vertical" && (
                <SeriesPoster item={item} />
              )}
              {item.Type === "Movie" && orientation === "horizontal" && (
                <ContinueWatchingPoster item={item} />
              )}
              {item.Type === "Movie" && orientation === "vertical" && (
                <MoviePoster item={item} />
              )}
              {item.Type === "Series" && <SeriesPoster item={item} />}
              {item.Type === "Program" && (
                <ContinueWatchingPoster item={item} />
              )}
              <ItemCardText item={item} />
            </TouchableItemRouter>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
