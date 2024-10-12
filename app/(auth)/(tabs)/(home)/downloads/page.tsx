import { Text } from "@/components/common/Text";
import { ItemContent } from "@/components/ItemContent";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

interface Props {
  item: BaseItemDto;
}

const DownloadPage: React.FC<Props> = ({ item }) => {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const fadeOut = (callback: any) => {
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const fadeIn = (callback: any) => {
    opacity.value = withTiming(1, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  useEffect(() => {
    if (item) {
      fadeOut(() => {});
    } else {
      fadeIn(() => {});
    }
  }, [item]);

  return (
    <View className="flex flex-1 relative">
      <Animated.View
        pointerEvents={"none"}
        style={[animatedStyle]}
        className="absolute top-0 left-0 flex flex-col items-start h-screen w-screen px-4 z-50 bg-black"
      >
        <View className="h-[350px] bg-transparent rounded-lg mb-4 w-full"></View>
        <View className="h-6 bg-neutral-900 rounded mb-1 w-12"></View>
        <View className="h-12 bg-neutral-900 rounded-lg mb-1 w-1/2"></View>
        <View className="h-12 bg-neutral-900 rounded-lg w-2/3 mb-10"></View>
        <View className="h-4 bg-neutral-900 rounded-lg mb-1 w-full"></View>
        <View className="h-12 bg-neutral-900 rounded-lg mb-1 w-full"></View>
        <View className="h-12 bg-neutral-900 rounded-lg mb-1 w-full"></View>
        <View className="h-4 bg-neutral-900 rounded-lg mb-1 w-1/4"></View>
      </Animated.View>
      {item && <ItemContent item={item} />}
    </View>
  );
};

export default DownloadPage;
