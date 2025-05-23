import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useFocusEffect, useRouter, withLayoutContext } from "expo-router";

import {
  type NativeBottomTabNavigationEventMap,
  createNativeBottomTabNavigator,
} from "@bottom-tabs/react-navigation";

const { Navigator } = createNativeBottomTabNavigator();
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

import { Colors } from "@/constants/Colors";
import { useSettings } from "@/utils/atoms/settings";
import { eventBus } from "@/utils/eventBus";
import { storage } from "@/utils/mmkv";
import type {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";
import { SystemBars } from "react-native-edge-to-edge";

export const NativeTabs = withLayoutContext<
  BottomTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(Navigator);

export default function TabLayout() {
  const [settings] = useSettings();
  const { t } = useTranslation();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const hasShownIntro = storage.getBoolean("hasShownIntro");
      if (!hasShownIntro) {
        const timer = setTimeout(() => {
          router.push("/intro/page");
        }, 1000);

        return () => {
          clearTimeout(timer);
        };
      }
    }, []),
  );

  return (
    <>
      <SystemBars hidden={false} style='light' />
      <NativeTabs
        sidebarAdaptable={false}
        ignoresTopSafeArea
        tabBarStyle={{
          backgroundColor: "#121212",
        }}
        tabBarActiveTintColor={Colors.primary}
        scrollEdgeAppearance='default'
      >
        <NativeTabs.Screen redirect name='index' />
        <NativeTabs.Screen
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              eventBus.emit("scrollToTop");
            },
          })}
          name='(home)'
          options={{
            title: t("tabs.home"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/house.fill.png")
                : ({ focused }) =>
                    focused
                      ? { sfSymbol: "house.fill" }
                      : { sfSymbol: "house" },
          }}
        />
        <NativeTabs.Screen
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              eventBus.emit("searchTabPressed");
            },
          })}
          name='(search)'
          options={{
            title: t("tabs.search"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/magnifyingglass.png")
                : ({ focused }) =>
                    focused
                      ? { sfSymbol: "magnifyingglass" }
                      : { sfSymbol: "magnifyingglass" },
          }}
        />
        <NativeTabs.Screen
          name='(favorites)'
          options={{
            title: t("tabs.favorites"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    focused
                      ? require("@/assets/icons/heart.fill.png")
                      : require("@/assets/icons/heart.png")
                : ({ focused }) =>
                    focused
                      ? { sfSymbol: "heart.fill" }
                      : { sfSymbol: "heart" },
          }}
        />
        <NativeTabs.Screen
          name='(libraries)'
          options={{
            title: t("tabs.library"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/server.rack.png")
                : ({ focused }) =>
                    focused
                      ? { sfSymbol: "rectangle.stack.fill" }
                      : { sfSymbol: "rectangle.stack" },
          }}
        />
        <NativeTabs.Screen
          name='(custom-links)'
          options={{
            title: t("tabs.custom_links"),
            // @ts-expect-error
            tabBarItemHidden: settings?.showCustomMenuLinks ? false : true,
            tabBarIcon:
              Platform.OS == "android"
                ? ({ focused }) => require("@/assets/icons/list.png")
                : ({ focused }) =>
                    focused
                      ? { sfSymbol: "list.dash.fill" }
                      : { sfSymbol: "list.dash" },
          }}
        />
      </NativeTabs>
    </>
  );
}
