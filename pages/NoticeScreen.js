import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchNotices } from "../store/announcementDataSlice";
import Header from "../components/Header"; // Make sure this path is correct

const NoticesScreen = () => {
  const dispatch = useDispatch();
  const { notices, status, error } = useSelector((state) => state.announcements);

  useEffect(() => {
    dispatch(fetchNotices());
  }, [dispatch]);

  const handleOpenLink = (url) => {
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(finalUrl).catch((err) =>
      console.error("Couldn't load page", err)
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.tab} onPress={() => handleOpenLink(item.link)}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      {/* Fixed Page Heading */}
      <View style={styles.headingContainer}>
        <Text style={styles.heading}>Notices</Text>
      </View>

      {/* Content List */}
      <FlatList
        data={notices}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          status === "loading" ? (
            <ActivityIndicator size="large" color="#004d40" style={styles.loader} />
          ) : status === "failed" ? (
            <Text style={styles.errorText}>Error: {error}</Text>
          ) : null
        }
      />
    </SafeAreaView>
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
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
  loader: {
    marginTop: 30,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    marginTop: 30,
  },
});

export default NoticesScreen;