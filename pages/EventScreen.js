import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchEvents } from "../store/announcementDataSlice";
import Header from "../components/Header";

const EventsScreen = () => {
  const dispatch = useDispatch();
  const { events, status, error } = useSelector((state) => state.announcements);

  useEffect(() => {
    dispatch(fetchEvents());
  }, [dispatch]);

  const handleOpenLink = (url) => {
    if (!url) return;

    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(finalUrl).catch((err) =>
      console.error("Couldn't load page", err)
    );
  };

  return (
    <View style={styles.container}>
      <Header />

      {/* Fixed Heading */}
      <View style={styles.headingContainer}>
        <Text style={styles.heading}>Events</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {status === "loading" && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#004d40" />
          </View>
        )}

        {status === "failed" && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}

        {events.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.tab}
            onPress={() => handleOpenLink(item.link)}
          >
            <Text style={styles.title}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e0f2f1",
  },
  headingContainer: {
    backgroundColor: "#ffffff",
    padding: 14,
    marginHorizontal: 16,
    marginTop: 20,
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 16,
  },
  tab: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#004d40",
  },
  readMore: {
    marginTop: 10,
    color: "#00796b",
    fontWeight: "bold",
    fontSize: 14,
  },
  statusContainer: {
    marginVertical: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "red",
  },
});

export default EventsScreen;