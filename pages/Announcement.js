import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchAchievements } from "../store/announcementDataSlice";
import Header from "../components/Header";

const Announcement = () => {
  const dispatch = useDispatch();
  const { achievements, status, error } = useSelector((state) => state.announcements);

  useEffect(() => {
    dispatch(fetchAchievements());
  }, [dispatch]);

  const handleOpenLink = (url) => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  const renderItem = ({ item }) => {
    const previewText =
      item.title.length > 200 ? item.title.substring(0, 200) + "..." : item.title;

    return (
      <View style={styles.tab}>
        <Text style={styles.title}>{previewText}</Text>
        {item.title.length > 200 && (
          <TouchableOpacity onPress={() => handleOpenLink(item.link)}>
            <Text style={styles.readMore}>Read More</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (status === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#004d40" />
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.headingContainer}>
        <Text style={styles.heading}>Announcements</Text>
      </View>
      <FlatList
        data={achievements}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e0f2f1",
  },
  headingContainer: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  heading: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#004d40",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  tab: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginTop: 12,
    borderRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    color: "#004d40",
    fontWeight: "500",
  },
  readMore: {
    marginTop: 10,
    color: "#00796b",
    fontWeight: "bold",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0f2f1",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff3f3",
  },
  errorText: {
    fontSize: 16,
    color: "red",
  },
});

export default Announcement;