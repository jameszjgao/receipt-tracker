import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getHouseholdMembers, HouseholdMember } from '@/lib/household-members';
import { getCurrentUser, getCurrentHousehold } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function HouseholdMembersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      const data = await getHouseholdMembers();
      setMembers(data);
      
      // 检查当前用户是否是管理员
      const currentUserMember = data.find(m => m.userId === user?.id);
      setIsCurrentUserAdmin(currentUserMember?.isAdmin || false);
    } catch (error) {
      console.error('Error loading household members:', error);
      Alert.alert('Error', 'Failed to load household members');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          if (diffMins < 1) return 'Just now';
          return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        }
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else {
        return format(date, 'MMM dd, yyyy');
      }
    } catch {
      return 'Unknown';
    }
  };

  const getDisplayName = (member: HouseholdMember) => {
    // 优先使用自定义名字，如果没有则使用邮箱前缀
    if (member.name && member.name.trim()) {
      return member.name.trim();
    }
    const emailPrefix = member.email.split('@')[0];
    return emailPrefix || 'Unknown';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Household Members</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isCurrentUserAdmin && (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => {
              // TODO: 实现邀请功能
              Alert.alert('Coming Soon', 'Invite feature will be available soon');
            }}
          >
            <Ionicons name="person-add-outline" size={20} color="#6C5CE7" />
            <Text style={styles.inviteButtonText}>Invite Member</Text>
          </TouchableOpacity>
        )}
        
        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color="#95A5A6" />
            <Text style={styles.emptyStateText}>No Members</Text>
            <Text style={styles.emptyStateSubtext}>Members will appear here</Text>
          </View>
        ) : (
          <View style={styles.membersList}>
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              return (
                <View key={member.userId} style={styles.memberCard}>
                  <View style={styles.memberHeader}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>{getDisplayName(member)}</Text>
                        {isCurrentUser && (
                          <View style={styles.currentUserBadge}>
                            <Text style={styles.currentUserBadgeText}>You</Text>
                          </View>
                        )}
                        {member.isAdmin && (
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminBadgeText}>Admin</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    {isCurrentUserAdmin && !isCurrentUser && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Ionicons name="close-circle-outline" size={24} color="#E74C3C" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.memberFooter}>
                    <Ionicons name="time-outline" size={14} color="#95A5A6" />
                    <Text style={styles.lastSignInText}>
                      Last sign in: {formatDateShort(member.lastSignInAt)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 8,
  },
  membersList: {
    gap: 12,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    gap: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  currentUserBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentUserBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  adminBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  removeButton: {
    padding: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: '#636E72',
  },
  memberFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lastSignInText: {
    fontSize: 13,
    color: '#95A5A6',
  },
});
