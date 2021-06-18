import Fetch from './Fetch.js';

/**
 * Enrich populates content with a lot of additional data that doesn't necessarily have to be saved
 * with the Quest itself such as Actor data.
 *
 * All enrich methods should only be used in getData of various Foundry apps / views.
 */
export default class Enrich
{
   static async giverFromQuest(quest)
   {
      let data = {};

      if (quest.giver === 'abstract')
      {
         data = {
            name: quest.giverName,
            img: quest.image,
            hasTokenImg: false
         };
      }
      else if (typeof quest.giver === 'string')
      {
         data = Enrich.giverFromUUID(quest.giver, quest.image);
      }

      return data;
   }

   static async giverFromUUID(uuid, imageType = 'actor')
   {
      let data = {};

      if (typeof uuid === 'string')
      {
         const document = await fromUuid(uuid);

         if (document !== null)
         {
            switch (document.documentName)
            {
               case Actor.documentName:
               {
                  const actorImage = document.img;
                  const tokenImage = document?.data?.token?.img;
                  const hasTokenImg = typeof tokenImage === 'string' && tokenImage !== actorImage;

                  data = {
                     uuid,
                     name: document.name,
                     img: imageType === 'token' && hasTokenImg ? tokenImage : actorImage,
                     hasTokenImg
                  };
                  break;
               }

               case Item.documentName:
                  data = {
                     uuid,
                     name: document.name,
                     img: document.img,
                     hasTokenImg: false
                  };
                  break;

               case JournalEntry.documentName:
                  data = {
                     uuid,
                     name: document.name,
                     img: document.data.img,
                     hasTokenImg: false
                  };
                  break;
            }
         }
      }

      return data;
   }

   /**
    * @param {SortedQuests}   sortedQuests
    *
    * @returns {Promise<object>}
    */
   static async sorted(sortedQuests)
   {
      const data = {};

      for (const key in sortedQuests)
      {
         data[key] = [];
         for (const quest of sortedQuests[key])
         {
            const questView = await Enrich.quest(quest);
            data[key].push(questView);
         }
      }

      return data;
   }

   /**
    * This method also performs content manipulation, for example enriching HTML or calculating amount
    * of done/total tasks etc.
    *
    * @param {Quest}  quest - Quest data to construct view data.
    *
    * @returns {Promise<object>} A single quest view or SortedQuests upgraded
    */
   static async quest(quest)
   {
      const data = {};

      data.id = quest.id;
      data.giver = quest.giver || null;
      data.name = quest.name || game.i18n.localize('ForienQuestLog.NewQuest');
      data.status = quest.status || 'hidden';
      data.description = quest.description || '';
      data.gmnotes = quest.gmnotes || '';
      data.image = quest.image || 'actor';
      data.giverName = quest.giverName || 'actor';
      data.giverImgPos = quest.giverImgPos || 'center';
      data.splash = quest.splash || '';
      data.splashPos = quest.splashPos || 'center';
      data.parent = quest.parent || null;
      data.subquests = quest.subquests || [];
      data.tasks = Array.isArray(quest.tasks) ? quest.tasks.map((task) => task.toJSON()) : [];
      data.rewards = Array.isArray(quest.rewards) ? quest.rewards.map((reward) => reward.toJSON()) : [];

      const isGM = game.user.isGM;
      const canPlayerDrag = game.settings.get('forien-quest-log', 'allowPlayersDrag');
      const countHidden = game.settings.get('forien-quest-log', 'countHidden');

      data.data_giver = await Enrich.giverFromQuest(quest);
      data.data_giver.id = quest.giver;

      data.isSubquest = false;
      if (data.parent !== null)
      {
         data.isSubquest = true;

         const parentData = Fetch.quest(data.parent);
         if (parentData)
         {
            data.data_parent = {
               id: data.parent,
               giver: parentData.giver,
               name: parentData.name,
               status: parentData.status
            };
         }
      }
      else
      {
         data.data_parent = {};
      }

      data.statusLabel = game.i18n.localize(`ForienQuestLog.QuestTypes.Labels.${data.status}`);

      if (countHidden)
      {
         data.checkedTasks = data.tasks.filter((t) => t.completed).length;
         data.totalTasks = data.tasks.length;
      }
      else
      {
         data.checkedTasks = data.tasks.filter((t) => t.hidden === false && t.completed).length;
         data.totalTasks = data.tasks.filter((t) => t.hidden === false).length;
      }

      // TODO EVALUATE: We no longer are allowing user data to be enriched / currently escaping
      data.data_tasks = data.tasks.map((task) =>
      {
         task.name = TextEditor.enrichHTML(task.name);
         return task;
      });

      data.data_rewards = data.rewards.map((item) =>
      {
         const type = item.type.toLowerCase();

         return {
            name: item.data.name,
            img: item.data.img,
            type,
            hidden: item.hidden,
            draggable: ((isGM || canPlayerDrag) && type !== 'abstract'),
            transfer: type !== 'abstract' ? JSON.stringify({ uuid: item.data.uuid }) : void 0
         };
      });

      data.data_subquest = [];

      if (data.subquests !== void 0)
      {
         for (const questId of data.subquests)
         {
            const subData = Fetch.quest(questId);

            if (subData)
            {
               data.data_subquest.push({
                  id: questId,
                  giver: subData.giver,
                  name: subData.name,
                  status: subData.status
               });
            }
         }
      }

      data.playerEdit = quest.isOwner;

      data.description = TextEditor.enrichHTML(data.description);

      if (!isGM)
      {
         data.data_tasks = data.data_tasks.filter((t) => t.hidden === false);
         data.data_rewards = data.data_rewards.filter((r) => r.hidden === false);
      }

      return data;
   }
}