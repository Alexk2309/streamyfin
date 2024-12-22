import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Slider } from "react-native-awesome-slider";
import * as Brightness from "expo-brightness";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const BrightnessSlider = () => {
  const brightness = useSharedValue(50);
  const min = useSharedValue(0);
  const max = useSharedValue(100);

  useEffect(() => {
    const fetchInitialBrightness = async () => {
      const initialBrightness = await Brightness.getBrightnessAsync();
      console.log("initialBrightness", initialBrightness);
      brightness.value = initialBrightness * 100;
    };
    fetchInitialBrightness();
  }, []);

  const handleValueChange = async (value: number) => {
    brightness.value = value;
    await Brightness.setBrightnessAsync(value / 100);
  };

  return (
    <View style={styles.sliderContainer}>
      <Slider
        progress={brightness}
        minimumValue={min}
        maximumValue={max}
        thumbWidth={0}
        onValueChange={handleValueChange}
        containerStyle={{
          borderRadius: 50,
          width: 125,
        }}
        theme={{
          minimumTrackTintColor: "#FDFDFD",
          maximumTrackTintColor: "#5A5A5A",
          bubbleBackgroundColor: "transparent", // Hide the value bubble
          bubbleTextColor: "transparent", // Hide the value text
        }}
      />
      <Ionicons
        name="sunny"
        size={20}
        color="#FDFDFD"
        style={{
          left: 70,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sliderContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
});

export default BrightnessSlider;
