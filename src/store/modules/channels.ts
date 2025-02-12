import {
  Module,
  VuexModule,
  Action,
  Mutation,
  getModule,
} from "vuex-module-decorators";
import store from "..";
import { saveCache } from "@/utils/localCache";
import Channel from "@/interfaces/Channel";
import router from "@/router";
import { getChannelByUserId } from "@/services/channelService";
import ky from "ky";
import { UsersModule } from "./users";
import DmChannelWithUser from "@/interfaces/DmChannelWithUser";

import { ServersModule } from "./servers";
import { MessagesModule } from "./messages";
import { NotificationsModule } from "./notifications";
import { TabsModule } from "./tabs";

interface ChannelObj {
  [key: string]: Channel;
}

@Module({ dynamic: true, store, namespaced: true, name: "channels" })
class Channels extends VuexModule {
  channels: ChannelObj = {};

  get rateLimitTimeLeft() {
    return (channelID: string, nowTimeStamp: number) => {
      const rateLimit = (this.channels[channelID]?.rateLimit || 0) * 1000;
      const lastStamp = MessagesModule.lastSentStamp(channelID);
      return lastStamp - nowTimeStamp + rateLimit;
    };
  }

  get serverChannels() {
    return (id: string) =>
      Object.values(this.channels).filter((c) => {
        if (c.server_id) return c.server_id === id;
        else return false;
      });
  }

  get isChannelOpen() {
    return (channelID: string) => {
      const route = router.currentRoute.value;
      const routeName = route.name as string;
      if (!routeName?.endsWith("message-area")) return;
      return route.params.channel_id === channelID;
    };
  }

  get sortedServerChannels() {
    return (id: string) => {
      const server = ServersModule.servers[id];
      const channel_position = server.channel_position;
      if (channel_position && channel_position.length) {
        return this.serverChannels(id).sort((a, b) => {
          const aIndex = channel_position.indexOf(a.channelID);
          const bIndex = channel_position.indexOf(b.channelID);
          if (aIndex < 0 || bIndex < 0) {
            return 1;
          }
          return aIndex - bIndex;
        });
      }
      return this.serverChannels(id);
    };
  }
  get getDMChannel() {
    return (channelID: string) => {
      const channel = this.channels[channelID];
      if (!channel) return;
      if (channel.server_id) return;
      const recipients = channel.recipients?.map((id) => UsersModule.users[id]);
      return { ...channel, recipients };
    };
  }
  get getDMChannels() {
    const filter = Object.values(this.channels).filter(
      (channel) => channel.recipients?.length && !channel.server_id
    );
    const map = filter.map((channel) => {
      const recipients = channel.recipients?.map((id) => UsersModule.users[id]);
      return { ...channel, recipients };
    });
    return map as unknown as Required<DmChannelWithUser>[];
  }

  @Mutation
  private INIT_CHANNELS(payload: ChannelObj | any) {
    this.channels = payload;
  }
  @Action
  public InitChannels(payload: ChannelObj | any) {
    saveCache("channels", payload);
    this.INIT_CHANNELS(payload);
  }
  @Mutation
  private ADD_CHANNEL(payload: Channel) {
    this.channels[payload.channelID] = payload;
  }
  @Action
  public AddChannel(payload: Channel) {
    this.ADD_CHANNEL(payload);
  }
  @Mutation
  private ADD_CHANNELS(payload: ChannelObj) {
    this.channels = { ...this.channels, ...payload };
  }
  @Action
  public AddChannels(payload: ChannelObj) {
    this.ADD_CHANNELS(payload);
  }
  @Mutation
  private REMOVE_CHANNEL(channelID: string) {
    delete this.channels[channelID];
  }
  @Action
  public RemoveChannel(channelID: string) {
    TabsModule.tabs.forEach((tab, index) => {
      setTimeout(() => {
        if (channelID === tab.channel_id && tab.path) {
          TabsModule.closeTabByPath(tab.path);
        }
      }, index * 100);
    });
    this.REMOVE_CHANNEL(channelID);
  }
  @Action
  public DeleteAllServerChannels(serverID: string) {
    const channels = this.serverChannels(serverID);
    if (!channels?.length) return;
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      NotificationsModule.DeleteNotification(channel.channelID);
      this.RemoveChannel(channel.channelID);
    }
  }
  @Action
  public LoadDmChannel(id: string) {
    const findChannel = Object.values(this.channels).find(
      (c) => c.recipients && c.recipients.includes(id)
    );
    if (findChannel) {
      router.push(`/app/dms/${findChannel?.channelID}`);
      return;
    }
    getChannelByUserId(id)
      .then((res) => {
        for (let i = 0; i < res.channel.recipients.length; i++) {
          const user = res.channel.recipients[i];
          UsersModule.AddUser(user);
        }
        this.ADD_CHANNEL({
          channelID: res.channel.channelID,
          recipients: res.channel.recipients.map((u) => u.id),
        });
        router.push(`/app/dms/${res.channel.channelID}`);
      })
      .catch((err: ky.HTTPError) => {
        console.log(err.name);
        // console.log(err.response)
      });
  }

  @Mutation
  private UPDATE_CHANNEL(payload: {
    channelID: string;
    update: Partial<Channel>;
  }) {
    Object.assign(this.channels[payload.channelID], payload.update);
  }
  @Action
  public updateChannel(payload: {
    channelID: string;
    update: Partial<Channel>;
  }) {
    if (!this.channels[payload.channelID]) return;
    this.UPDATE_CHANNEL(payload);
  }
}
export const ChannelsModule = getModule(Channels);
