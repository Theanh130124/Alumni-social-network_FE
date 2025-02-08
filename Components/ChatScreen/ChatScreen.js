import { useContext, useEffect, useState } from "react";
import { RoomContext } from "../../App";
import { Text, View, StyleSheet, Image, FlatList, ActivityIndicator, TextInput, TouchableOpacity } from "react-native";
import { getMessbyRoom, sendMess } from "../../configs/API/roomApi";
import { useNavigation } from "@react-navigation/native";
import { getToken } from "../../configs/api";
import { CurrentUserContext } from "../../App";

const ChatScreen = () => {
    const [mess, setMess] = useState([]);
    const [room] = useContext(RoomContext) || [{}]; 
    const [isPolling, setIsPolling] = useState(false);

    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextPage, setNextPage] = useState(null);
    const [newMess, setNewMess] = useState("");
    const navigation = useNavigation();
    const [currentUser] = useContext(CurrentUserContext);
    const otherUser = room.first_user.user.id === currentUser.id ? room.second_user : room.first_user;
    useEffect(() => {
        const fetchToken = async () => {
            const userToken = await getToken();
            setToken(userToken);
        };
        fetchToken();
    }, []);

    // Định nghĩa lại hàm fetchMess ở ngoài useEffect
    const fetchMess = async (isInitialLoad = false) => {
        if (token && room) {
            try {
                if (isInitialLoad) setLoading(true); // Chỉ bật loading khi tải lần đầu
                setIsPolling(true); // Bắt đầu Polling
                const response = await getMessbyRoom(token, room.id);
                if (response && response.results) {
                    // Chỉ cập nhật tin nhắn mới
                    if (response.results.length !== mess.length) {
                        setMess(response.results);
                        setNextPage(response.next);
                    }
                }
            } catch (error) {
                console.log("Error fetching messages", error);
            } finally {
                if (isInitialLoad) setLoading(false); // Tắt loading khi tải lần đầu xong
                setIsPolling(false); // Kết thúc Polling
            }
        }
    };
    //Kỹ thực Polling -> real time 
        useEffect(()=>{
            fetchMess()//gọi lần đầu 
            const interval = setInterval(()=>{
                fetchMess();//Cập nhật tin mỗi 0,5s
            },500);
            return () => clearInterval(interval);
        },[token,room]);


    

    useEffect(() => {
        fetchMess(); // Gọi fetchMess khi token hoặc room thay đổi
    }, [token, room]);

    const loadMoreMess = async () => {
        if (nextPage && !loadingMore) {
            try {
                setLoadingMore(true);
                const response = await fetch(nextPage, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (data && data.results) {
                    setMess((prevMess) => [...prevMess, ...data.results]);
                    setNextPage(data.next);
                }
            } catch (error) {
                console.log("Error loading more messages", error);
            } finally {
                setLoadingMore(false);
            }
        }
    };
    

    const renderMessItem = ({ item }) => {
        const isCurrentUser = item.who_sent?.user?.id === currentUser.id;
            const avatarUrl = isCurrentUser 
        ? '' 
        : otherUser?.avatar?.replace('image/upload/', '') || '';
        
        
        const fullAvatarUrl = avatarUrl

        return (
            <View
                style={[
                    styles.messageContainer,
                    isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
                ]}
            >
                {!isCurrentUser && ( // Chỉ hiển thị avatar nếu không phải currentUser
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatar}
                    />
                </View>
            )}

                <View style={styles.messageContent}>
                    <Text style={styles.messageText}>{item.content}</Text>
                    <Text style={styles.timestamp}>
                        {new Date(item.timestamp).toLocaleString()}
                    </Text>
                    {item.seen && <Text style={styles.seen}>Đã xem</Text>}
                </View>
            </View>
        );
    };

    const handleSendMessage = async () => {
        if (newMess.trim() !== "") {
            try {
                console.log("Đang gửi tin nhắn...");
                const response = await sendMess(token, newMess, currentUser.id, room.id);

                if (response) {
                    console.log("Tin nhắn đã được gửi:", response);
                    const newMessage = {
                        ...response,
                        who_sent: {
                            user: { id: room.first_user.user.id } // Đảm bảo đây là user.id của first_user tren giao dien 
                        }
                    };
                    setMess((prevMess) => [...prevMess, newMessage]);
                    setNewMess("");
                    fetchMess()
                   
                }
            } catch (error) {
                console.log("Lỗi gửi tin nhắn", error);
            }
        } else {
            console.log("Tin nhắn trống!");
        }
    };
    

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tin nhắn</Text>
            
            <Text style={styles.roomInfo}>{otherUser.full_name}</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : mess.length === 0 ? (
                <Text>Không có tin nhắn nào</Text>
            ) : (
                <FlatList
                    data={mess}
                    renderItem={renderMessItem}
                    keyExtractor={(item) => item.id.toString()}
                    onEndReached={loadMoreMess}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore && <ActivityIndicator size="small" />}
                />
            )}

            <View style={styles.inputContainer}>
                <TextInput 
                    style={styles.input}
                    placeholder="Nhập tin nhắn..."
                    value={newMess}
                    onChangeText={setNewMess}
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                    <Text style={styles.sendText}>Gửi</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f8f8", 
        paddingTop:50,
        paddingLeft:15,
        paddingBottom:15,
        paddingRight:15,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 15,
        color: "#333",
    },
    roomInfo: {
        fontSize: 18,
        marginBottom: 10,
        fontWeight: "500",
        color: "#666",
    },
    messageContainer: {
        flexDirection: "row",
        padding: 12,
        alignItems: "center",
        marginVertical: 8,
        borderRadius: 10,
        backgroundColor: "#fff", 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    currentUserMessage: {
        justifyContent: "flex-end",
        alignSelf: "flex-end",
        backgroundColor: "#DCF8C6", 
    },
    otherUserMessage: {
        justifyContent: "flex-start",
        alignSelf: "flex-start",
        backgroundColor: "#EAEAEA", 
    },
    avatarContainer: {
        marginRight: 10,
    },
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: "#ddd", 
    },
    messageContent: {
        maxWidth: "80%",
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#f9f9f9", 
        elevation: 2,
    },
    messageText: {
        fontSize: 16,
        color: "#333",
    },
    timestamp: {
        fontSize: 12,
        color: "#aaa",
        marginTop: 5,
    },
    seen: {
        fontSize: 10,
        color: "green",
        marginTop: 5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    input: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingLeft: 15,
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 20,
    },
    sendText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});

export default ChatScreen;
