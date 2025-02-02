import React, { Component } from 'react';
import { Layout, Tab, TabView, List, Spinner, withStyles } from '@ui-kitten/components';
import { SafeAreaView, View, FlatList } from 'react-native';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { getInboxes } from 'actions/inbox';
import { getAgents } from 'actions/agent';
import {
  getConversations,
  loadInitialMessage,
  setConversation,
  setAssigneeType,
} from 'actions/conversation';
import CustomText from 'components/Text';
import { saveDeviceDetails } from 'actions/notification';
import { getAllNotifications } from 'actions/notification';
import ConversationItem from '../../components/ConversationItem';
import ConversationItemLoader from 'components/ConversationItemLoader';
import styles from './ConversationList.style';
import i18n from 'i18n';
import ActionCable from 'helpers/ActionCable';
import { getPubSubToken, getUserDetails } from 'helpers/AuthHelper';
import { onLogOut } from 'actions/auth';
import HeaderBar from 'components/HeaderBar';
import { findUniqueConversations } from 'helpers';
import { clearAllDeliveredNotifications } from 'helpers/PushHelper';
import Empty from 'components/Empty';
import images from 'constants/images';

const LoaderData = new Array(24).fill(0);

const renderItemLoader = () => <ConversationItemLoader />;

const wait = (timeout) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

class ConversationListComponent extends Component {
  static propTypes = {
    eva: PropTypes.shape({
      style: PropTypes.object,
      theme: PropTypes.object,
    }).isRequired,
    navigation: PropTypes.shape({
      navigate: PropTypes.func.isRequired,
    }).isRequired,
    conversations: PropTypes.shape([]),
    isFetching: PropTypes.bool,
    isAllConversationsLoaded: PropTypes.bool,
    getInboxes: PropTypes.func,
    getAgents: PropTypes.func,
    loadInitialMessages: PropTypes.func,
    getConversations: PropTypes.func,
    selectConversation: PropTypes.func,
    saveDeviceDetails: PropTypes.func,
    getAllNotifications: PropTypes.func,
    setAssigneeType: PropTypes.func,

    inboxSelected: PropTypes.shape({
      name: PropTypes.string,
    }),
    conversationTypingUsers: PropTypes.shape({}),
    inboxes: PropTypes.array.isRequired,
    conversationStatus: PropTypes.string,
    webSocketUrl: PropTypes.string,
    pushToken: PropTypes.string,
    item: PropTypes.shape({}),
  };

  static defaultProps = {
    isFetching: false,
    isAllConversationsLoaded: false,
    getInboxes: () => {},
    getAgents: () => {},
    getConversations: () => {},
    loadInitialMessages: () => {},
    selectConversation: () => {},
    setAssigneeType: () => {},

    item: {},
    inboxes: [],
    conversationStatus: 'open',
  };

  state = {
    selectedIndex: 0,
    onEndReachedCalledDuringMomentum: true,
    pageNumber: 1,
    refreshing: false,
  };

  componentDidMount = () => {
    clearAllDeliveredNotifications();
    this.props.getInboxes();
    this.props.getAgents();
    this.loadConversations();
    this.initActionCable();
    this.props.getAllNotifications({ pageNo: 1 });
    const { pushToken } = this.props;
    this.props.saveDeviceDetails({ token: null });
    if (!pushToken) {
      this.props.saveDeviceDetails({ token: pushToken });
    }
  };

  initActionCable = async () => {
    const pubSubToken = await getPubSubToken();
    const { accountId, userId } = await getUserDetails();
    const { webSocketUrl } = this.props;

    ActionCable.init({ pubSubToken, webSocketUrl, accountId, userId });
  };

  loadConversations = () => {
    const { selectedIndex, pageNumber } = this.state;

    this.props.getConversations({
      assigneeType: selectedIndex,
      pageNumber,
    });
  };

  onEndReached = async ({ distanceFromEnd }) => {
    const { onEndReachedCalledDuringMomentum } = this.state;

    if (!onEndReachedCalledDuringMomentum) {
      await this.setState((state) => ({
        pageNumber: state.pageNumber + 1,
      }));

      this.loadConversations();
      this.setState({
        onEndReachedCalledDuringMomentum: true,
      });
    }
  };

  onSelectConversation = (item) => {
    const { messages, meta } = item;

    const conversationId = item.id;

    const { navigation, selectConversation, loadInitialMessages } = this.props;
    selectConversation({ conversationId });
    loadInitialMessages({ messages });
    navigation.navigate('ChatScreen', {
      conversationId,
      meta,
      messages,
    });
  };

  openFilter = () => {
    const { navigation, inboxSelected } = this.props;
    const { selectedIndex } = this.state;
    navigation.navigate('ConversationFilter', {
      assigneeType: selectedIndex,
      inboxSelected,
    });
  };

  onChangeTab = async (index) => {
    await this.setState({
      selectedIndex: index,
      pageNumber: 1,
    });
    this.props.setAssigneeType({ assigneeType: index });
    this.loadConversations();
  };

  renderItem = ({ item }) => (
    <ConversationItem
      item={item}
      onSelectConversation={this.onSelectConversation}
      inboxes={this.props.inboxes}
      conversationTypingUsers={this.props.conversationTypingUsers}
    />
  );

  renderMoreLoader = () => {
    const {
      isAllConversationsLoaded,
      eva: { style },
    } = this.props;

    return (
      <View style={style.loadMoreSpinnerView}>
        {!isAllConversationsLoaded ? (
          <Spinner size="medium" />
        ) : (
          <CustomText> {i18n.t('CONVERSATION.ALL_CONVERSATION_LOADED')} 🎉</CustomText>
        )}
      </View>
    );
  };

  renderList = () => {
    const {
      conversations,
      eva: { style },
    } = this.props;

    const { payload } = conversations;

    const uniqueConversations = findUniqueConversations({ payload });
    return (
      <Layout style={style.tabContainer}>
        <FlatList
          onRefresh={() => this.onRefresh()}
          refreshing={this.state.refreshing}
          keyboardShouldPersistTaps="handled"
          data={uniqueConversations}
          renderItem={this.renderItem}
          ref={(ref) => {
            this.myFlatListRef = ref;
          }}
          onEndReached={this.onEndReached.bind(this)}
          onEndReachedThreshold={0.01}
          onMomentumScrollBegin={() => {
            this.setState({
              onEndReachedCalledDuringMomentum: false,
            });
          }}
          ListFooterComponent={this.renderMoreLoader}
          keyExtractor={(item) => item.id.toString()}
        />
      </Layout>
    );
  };

  renderEmptyList = () => {
    const {
      eva: { style },
    } = this.props;
    return (
      <Layout style={style.tabContainer}>
        <List data={LoaderData} renderItem={renderItemLoader} />
      </Layout>
    );
  };

  renderEmptyMessage = () => {
    const {
      eva: { style },
    } = this.props;
    return (
      <Layout style={style.tabContainer}>
        <Empty image={images.emptyConversations} title={i18n.t('CONVERSATION.EMPTY')} />
      </Layout>
    );
  };

  onRefresh = () => {
    this.setState({ refreshing: true });
    this.loadConversations();
    wait(1000).then(() => this.setState({ refreshing: false }));
  };

  renderTab = ({ tabIndex, selectedIndex, tabTitle, payload, isFetching, renderList, style }) => {
    return (
      <Tab
        title={tabTitle}
        titleStyle={selectedIndex === tabIndex ? style.tabActiveTitle : style.tabNotActiveTitle}>
        <View style={style.tabView}>
          {!isFetching || payload.length ? (
            <React.Fragment>
              {payload && payload.length ? this.renderList() : this.renderEmptyMessage()}
            </React.Fragment>
          ) : (
            this.renderEmptyList()
          )}
        </View>
      </Tab>
    );
  };

  render() {
    const { selectedIndex } = this.state;
    const {
      conversations,
      isFetching,
      inboxSelected,
      conversationStatus,
      eva: { style },
    } = this.props;

    const { payload, meta } = conversations;
    const { name: inBoxName } = inboxSelected;

    const mineCount = meta ? `(${meta.mine_count})` : '';
    const unAssignedCount = meta ? `(${meta.unassigned_count})` : '';
    const allCount = meta ? `(${meta.all_count})` : '';

    const headerTitle = i18n.t('FOOTER.CONVERSATION');

    return (
      <SafeAreaView style={style.container}>
        <HeaderBar
          title={headerTitle}
          showRightButton
          onRightPress={this.openFilter}
          buttonType="menu"
        />

        <TabView
          selectedIndex={selectedIndex}
          indicatorStyle={style.tabViewIndicator}
          onSelect={this.onChangeTab}
          tabBarStyle={style.tabBar}>
          {this.renderTab({
            tabIndex: 0,
            selectedIndex,
            tabTitle: `${i18n.t('CONVERSATION.MINE')} ${mineCount}`,
            payload,
            isFetching,
            style,
          })}
          {this.renderTab({
            tabIndex: 1,
            selectedIndex,
            tabTitle: `${i18n.t('CONVERSATION.UN_ASSIGNED')} ${unAssignedCount}`,
            payload,
            isFetching,
            style,
          })}
          {this.renderTab({
            tabIndex: 2,
            selectedIndex,
            tabTitle: `${i18n.t('CONVERSATION.ALL')} ${allCount}`,
            payload,
            isFetching,
            style,
          })}
        </TabView>
      </SafeAreaView>
    );
  }
}

function bindAction(dispatch) {
  return {
    getInboxes: () => dispatch(getInboxes()),
    getAgents: () => dispatch(getAgents()),
    getConversations: ({ assigneeType, pageNumber }) =>
      dispatch(
        getConversations({
          assigneeType,
          pageNumber,
        }),
      ),
    selectConversation: ({ conversationId }) => dispatch(setConversation({ conversationId })),
    loadInitialMessages: ({ messages }) => dispatch(loadInitialMessage({ messages })),
    saveDeviceDetails: ({ token }) => dispatch(saveDeviceDetails({ token })),
    getAllNotifications: ({ pageNo }) => dispatch(getAllNotifications({ pageNo })),
    setAssigneeType: ({ assigneeType }) => dispatch(setAssigneeType({ assigneeType })),

    onLogOut: () => dispatch(onLogOut()),
  };
}
function mapStateToProps(state) {
  return {
    webSocketUrl: state.settings.webSocketUrl,
    isFetching: state.conversation.isFetching,
    isAllConversationsLoaded: state.conversation.isAllConversationsLoaded,
    conversations: state.conversation.data,
    conversationStatus: state.conversation.conversationStatus,
    inboxSelected: state.inbox.inboxSelected,
    inboxes: state.inbox.data,
    conversationTypingUsers: state.conversation.conversationTypingUsers,
    pushToken: state.notification.pushToken,
  };
}

const ConversationList = withStyles(ConversationListComponent, styles);
export default connect(mapStateToProps, bindAction)(ConversationList);
